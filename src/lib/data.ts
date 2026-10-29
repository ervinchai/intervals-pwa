import { getConfig, type MockEndpoint } from '@/lib/config'
import {
  BriefingSchema,
  FinanceAccountCollectionSchema,
  FinanceBudgetCollectionSchema,
  FinanceForecastSchema,
  FinanceOverviewSchema,
  FinanceRecurringCollectionSchema,
  FinanceStatementCollectionSchema,
  FinanceStatementSchema,
  type FinanceAccount,
  type FinanceBudget,
  type FinanceForecast,
  type FinanceOverview,
  type FinanceRecurringPayment,
  type FinanceStatement,
  BrewLogEntrySchema,
  CoffeeBeanSchema,
  CoffeeBeanSummarySchema,
  CoffeeCollectionSchema,
  MealPlanSchema,
  RecipeCollectionSchema,
  RecipeSchema,
  SavedAnalysisSchema,
  ShotAnalysisErrorSchema,
  ShotAnalysisItemSchema,
  ShotAnalysisThinkingSchema,
  ShotRecordSchema,
  type BeanCreateInput,
  type BrewResult,
  type Briefing,
  type BrewLogEntry,
  type BrewLogInput,
  type CoffeeBean,
  type CoffeeBeanSummary,
  type CoffeeCollection,
  type MealPlan,
  type PrintLabelInput,
  PrintStatusEventSchema,
  PrintStreamErrorSchema,
  type PrintReason,
  type Recipe,
  type RecipeCollection,
  type SavedAnalysis,
  type ShotAnalysisItem,
} from '@/lib/contracts'
import type { ShotRecord } from '@/lib/flow'
import {
  mockBean,
  mockBeanList,
  mockCreateBean,
  mockLogBrew,
  mockSetBeanStatus,
  mockSetTargetBrew,
  mockShotAnalysisItems,
} from '@/mock/coffee'
import {
  mockFinanceAccounts,
  mockFinanceBudgets,
  mockFinanceConfirm,
  mockFinanceForecast,
  mockFinanceOverview,
  mockFinanceRecurring,
  mockFinanceStatements,
  mockFinanceUpload,
} from '@/mock/finance'
import { MOCK_BRIEFING, MOCK_MEAL_PLAN, MOCK_RECIPES } from '@/mock/data'

import type { BeanStatus } from '@/lib/coffee-utils'
import { errorFrom, RailsError, railsRequest, railsUpload } from '@/lib/rails'
import { readSse } from '@/lib/sse'

import type { ZodType } from 'zod'

/**
 * The single seam between screens and the backend. Screens call these and never
 * know whether the bytes came from the backend or from a fixture, so wiring up real
 * endpoints is a config flip rather than a screen rewrite.
 *
 * Coffee and printing call the Rails API (`railsRequest`). The rest still maps to
 * one Windmill script each, run synchronously via the
 * `run_wait_result` API, which returns the script's return value directly. The
 * script paths live under the `intervals/` folder of the Windmill workspace and
 * are kept in sync from the intervals-backend repo (wmill git-sync).
 */

/** Simulated latency so loading states are exercised during development. */
const MOCK_DELAY_MS = 250

function mock<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), MOCK_DELAY_MS))
}

/**
 * Whether a given endpoint should serve fixtures. Defaults to `useMockData`,
 * but a per-endpoint override lets one endpoint go live ahead of the rest.
 */
function shouldMock(endpoint: MockEndpoint): boolean {
  const config = getConfig()
  return config.mockOverrides[endpoint] ?? config.useMockData
}

/**
 * Run a Windmill script by path and validate its result against a contract.
 *
 * `scriptPath` is the path within the `f/` folder, without that prefix
 * (e.g. `intervals/today`). `args` become the script's inputs.
 *
 * The endpoint is `run_wait_result/p/{fullPath}`, where `p` selects "script by
 * path" (vs `f` for a flow) and the script's full path includes the `f/`
 * folder — hence the `p/f/` below.
 */
async function runScript<T>(
  scriptPath: string,
  args: Record<string, unknown>,
  schema: ZodType<T>,
): Promise<T> {
  const config = getConfig()

  if (!config.windmillBaseUrl || !config.windmillWorkspace) {
    throw new Error(`Windmill is not configured; cannot run ${scriptPath}`)
  }

  const url = `${config.windmillBaseUrl}/api/w/${config.windmillWorkspace}/jobs/run_wait_result/p/f/${scriptPath}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(config.windmillToken ? { Authorization: `Bearer ${config.windmillToken}` } : {}),
    },
    body: JSON.stringify(args),
  })

  if (!res.ok) {
    throw new Error(`${scriptPath} returned ${res.status}`)
  }

  // Validate at the boundary — a drifted Windmill script should surface as a
  // named error here, not as a crash three components deep.
  const parsed = schema.safeParse(await res.json())
  if (!parsed.success) {
    console.error(`[intervals] ${scriptPath} failed its contract`, parsed.error.issues)
    throw new Error(`${scriptPath} did not match its contract`)
  }

  return parsed.data
}

export async function fetchRecipe(id: string): Promise<Recipe> {
  if (shouldMock('recipes')) {
    const recipe = MOCK_RECIPES[id]
    if (!recipe) throw new Error(`No mock recipe "${id}"`)
    return mock(recipe)
  }
  return runScript('intervals/recipe_by_id', { id }, RecipeSchema)
}

export async function fetchRecipeCollection(): Promise<RecipeCollection> {
  if (shouldMock('recipes')) {
    // Derive summaries from the full fixtures so the two never drift apart.
    const recipes = Object.values(MOCK_RECIPES).map(
      ({ id, title, imageUrl, timeMinutes, servings, cuisine }) => ({
        id,
        title,
        imageUrl,
        timeMinutes,
        servings,
        cuisine,
      }),
    )
    return mock({ recipes })
  }
  return runScript('intervals/recipes', {}, RecipeCollectionSchema)
}

export async function fetchMealPlan(): Promise<MealPlan> {
  if (shouldMock('mealPlan')) return mock(MOCK_MEAL_PLAN)
  return runScript('intervals/meal_plan', {}, MealPlanSchema)
}

export async function fetchBriefing(): Promise<Briefing> {
  if (shouldMock('today')) return mock(MOCK_BRIEFING)
  return runScript('intervals/today', {}, BriefingSchema)
}

/** The coffee-bean catalog for the grid — summaries only. */
export async function fetchCoffeeCollection(): Promise<CoffeeCollection> {
  if (shouldMock('coffee')) {
    // Derive summaries from the full fixtures so the two never drift apart.
    const beans = mockBeanList().map(
      ({ id, name, roaster, origin, roastLevel, roastDate, status }) => ({
        id,
        name,
        roaster,
        origin,
        roastLevel,
        roastDate,
        status,
      }),
    )
    return mock({ beans })
  }
  return railsRequest('GET', '/coffee/beans', CoffeeCollectionSchema)
}

/** One bean plus its brew-log history, addressed by its Bean ID / QR code. */
export async function fetchCoffeeBean(id: string): Promise<CoffeeBean> {
  if (shouldMock('coffee')) {
    const bean = mockBean(id)
    if (!bean) throw new Error(`No mock bean "${id}"`)
    return mock(bean)
  }
  return railsRequest('GET', `/coffee/beans/${encodeURIComponent(id)}`, CoffeeBeanSchema)
}

/** Append a calibration entry to a bean's brew log. */
export async function logBrew(input: BrewLogInput): Promise<BrewLogEntry> {
  if (shouldMock('coffee')) return mock(mockLogBrew(input))
  // The bean is in the path, so it is not repeated in the body.
  const { beanId, ...fields } = input
  return railsRequest('POST', `/coffee/beans/${encodeURIComponent(beanId)}/brews`, BrewLogEntrySchema, fields)
}

/**
 * The scale's record of a logged brew, for its overview, or null when the scale did not read it (logged by
 * hand, or before shots were kept). Rails only; mock mode has none.
 */
export async function fetchShotRecord(beanId: string, brewId: string): Promise<ShotRecord | null> {
  if (shouldMock('coffee')) return null
  try {
    return await railsRequest('GET', `/coffee/beans/${encodeURIComponent(beanId)}/brews/${encodeURIComponent(brewId)}/shot`, ShotRecordSchema)
  } catch (err) {
    if (err instanceof RailsError && err.code === 'shot_not_found') return null
    throw err
  }
}

/**
 * The AI's saved reading of a logged brew, or null when it has not been read. Rails only; mock mode has none.
 * A new reading replaces it (see `analyseShot` with a `brewId`).
 */
export async function fetchSavedAnalysis(beanId: string, brewId: string): Promise<SavedAnalysis | null> {
  if (shouldMock('coffee')) return null
  try {
    return await railsRequest(
      'GET',
      `/coffee/beans/${encodeURIComponent(beanId)}/brews/${encodeURIComponent(brewId)}/shot_analysis`,
      SavedAnalysisSchema,
    )
  } catch (err) {
    if (err instanceof RailsError && err.code === 'analysis_not_found') return null
    throw err
  }
}

/** A shot for the AI to read: the overview's numbers and taste, and the scale's record. */
export type ShotAnalysisInput = {
  grind?: string
  doseG?: number
  yieldG?: number
  timeS?: number
  waterTempC?: number
  targetG?: number
  result?: BrewResult
  record?: ShotRecord
  /** A logged brew read again: the server leaves it and later shots out of its history. */
  brewId?: string
}

/** What the analysis stream reports while it runs. */
export type ShotAnalysisHandlers = {
  /** What the AI is working out, before its first item. */
  onThinking?: (text: string) => void
  /** One finished item. They come in order: summary, suggestions, observations, verdict. */
  onItem: (item: ShotAnalysisItem) => void
}

/**
 * Asks the server's AI to read a shot (its flow curve, taste, the bean and its last shots) and say what to
 * change next. The reading arrives item by item, so the caller can show it grow; the promise settles when it
 * is complete. It rejects with a `RailsError` when the call fails before the stream, or when the AI fails
 * partway (the items already handed over stay valid). Takes about 10 s. Needs the Rails server: there is no
 * Windmill version.
 */
export async function analyseShot(beanId: string, input: ShotAnalysisInput, handlers: ShotAnalysisHandlers): Promise<void> {
  if (shouldMock('coffee')) {
    for (const item of mockShotAnalysisItems()) {
      await mock(null)
      handlers.onItem(item)
    }
    return
  }
  const { railsBaseUrl } = getConfig()
  if (!railsBaseUrl) throw new RailsError('Shot analysis needs the Rails server: set railsBaseUrl.', 0, 'not_configured')

  const path = `/coffee/beans/${encodeURIComponent(beanId)}/shot_analyses`
  let res: Response
  try {
    res = await fetch(`${railsBaseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (err) {
    console.error(`[intervals] POST ${path} could not reach the server`, err)
    throw new RailsError('Could not reach the server. Check the connection and try again.', 0, 'network')
  }
  if (!res.ok) throw await errorFrom(res)
  if (!res.body) throw new RailsError('The server sent something unexpected.', res.status, 'contract')

  try {
    for await (const { event, data } of readSse(res.body)) {
      if (event === 'done') return
      if (event === 'error') {
        const parsed = ShotAnalysisErrorSchema.safeParse(JSON.parse(data))
        const code = parsed.success && parsed.data.reason ? parsed.data.reason : 'analysis_failed'
        throw new RailsError('The AI could not read this shot. Try again.', res.status, code)
      }
      if (event === 'thinking') {
        const parsed = ShotAnalysisThinkingSchema.safeParse(JSON.parse(data))
        if (parsed.success) handlers.onThinking?.(parsed.data.text)
        continue
      }
      if (event === 'item') {
        const parsed = ShotAnalysisItemSchema.safeParse(JSON.parse(data))
        if (parsed.success) handlers.onItem(parsed.data)
        else console.error('[intervals] shot analysis item failed its contract', parsed.error.issues)
      }
    }
  } catch (err) {
    if (err instanceof RailsError) throw err
    console.error(`[intervals] POST ${path} stream failed`, err)
    throw new RailsError('The connection dropped while the AI was reading. Try again.', res.status, 'network')
  }
  // The stream closed with no `done`: the connection dropped.
  throw new RailsError('The connection dropped while the AI was reading. Try again.', res.status, 'network')
}

/** Mark a brew as a bean's target (dialed-in) recipe; returns the updated bean. */
export async function setTargetBrew(beanId: string, brewId: string): Promise<CoffeeBean> {
  if (shouldMock('coffee')) return mock(mockSetTargetBrew(beanId, brewId))
  return railsRequest('PATCH', `/coffee/beans/${encodeURIComponent(beanId)}/target`, CoffeeBeanSchema, { brewId })
}

/** Set a bag's status (Sealed, Open or Finished); returns the refreshed bean. */
export async function setBeanStatus(beanId: string, status: BeanStatus): Promise<CoffeeBean> {
  if (shouldMock('coffee')) return mock(mockSetBeanStatus(beanId, status))
  return railsRequest('PATCH', `/coffee/beans/${encodeURIComponent(beanId)}`, CoffeeBeanSchema, { status })
}

/** Catalog a new bean; returns the created summary, with the Bean ID the server assigned. */
export async function createBean(input: BeanCreateInput): Promise<CoffeeBeanSummary> {
  if (shouldMock('coffee')) return mock(mockCreateBean(input))
  return railsRequest('POST', '/coffee/beans', CoffeeBeanSummarySchema, input)
}

/** How a print ended. A failure carries a neutral reason the UI turns into copy. */
export type PrintOutcome = { ok: true } | { ok: false; reason: PrintReason }

/**
 * Send a rendered label to the printer through the Rails API.
 *
 * `POST /prints` replies with Server-Sent Events: `connecting → printing →
 * completed | error`. `EventSource` can't POST, so the stream is read with
 * `fetch()`. `onState` hears the in-progress steps; the returned promise
 * settles with the outcome. A stream that ends without `completed` or `error`
 * was cut off, so it counts as `connection_lost`. This is an action, not a
 * resource, so it isn't in `mockOverrides`; in mock mode it plays a short
 * fake print.
 */
export async function printLabel(
  input: PrintLabelInput,
  onState: (state: 'connecting' | 'printing') => void,
): Promise<PrintOutcome> {
  if (getConfig().useMockData) {
    onState('connecting')
    await mock(null)
    onState('printing')
    await mock(null)
    return { ok: true }
  }

  const { railsBaseUrl } = getConfig()
  if (!railsBaseUrl) {
    console.error('[intervals] railsBaseUrl is not configured; cannot print')
    return { ok: false, reason: 'service_unavailable' }
  }

  try {
    const res = await fetch(`${railsBaseUrl}/prints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok || !res.body) {
      console.error(`[intervals] POST /prints returned ${res.status}`)
      return { ok: false, reason: 'service_unavailable' }
    }

    for await (const { event, data } of readSse(res.body)) {
      if (event === 'error') {
        const parsed = PrintStreamErrorSchema.safeParse(JSON.parse(data))
        return { ok: false, reason: parsed.success ? parsed.data.reason : 'service_unavailable' }
      }
      const parsed = PrintStatusEventSchema.safeParse(JSON.parse(data))
      if (!parsed.success) {
        console.error('[intervals] print status failed its contract', parsed.error.issues)
        continue
      }
      const { state, reason } = parsed.data
      if (state === 'completed') return { ok: true }
      if (state === 'error') return { ok: false, reason: reason ?? 'printer_error' }
      onState(state)
    }
  } catch (err) {
    console.error('[intervals] print stream failed', err)
    return { ok: false, reason: 'connection_lost' }
  }

  // The stream closed with no terminal event: the connection dropped.
  return { ok: false, reason: 'connection_lost' }
}

/* ---------------------------------------------------------------------------
   Finance (Rails API, /finance/*).
--------------------------------------------------------------------------- */

/**
 * The cash month by month. With `cancelPaymentIds` it is a what-if: the server runs the forecast without
 * those payments, saves nothing, and the reply carries a `comparison` with the plain forecast.
 */
export async function fetchFinanceForecast(options: {
  months: number
  pay: 'expected' | 'earliest'
  cancelPaymentIds?: number[]
}): Promise<FinanceForecast> {
  const { months, pay, cancelPaymentIds = [] } = options
  if (shouldMock('finance')) return mock(mockFinanceForecast(months, pay, cancelPaymentIds))
  if (cancelPaymentIds.length > 0) {
    return railsRequest('POST', '/finance/forecast', FinanceForecastSchema, { months, pay, scenario: { cancelPaymentIds } })
  }
  return railsRequest('GET', `/finance/forecast?months=${months}&pay=${pay}`, FinanceForecastSchema)
}

/** Monthly cost of the live recurring payments, by category, with what is due soon and what ends soon. */
export async function fetchFinanceOverview(): Promise<FinanceOverview> {
  if (shouldMock('finance')) return mock(mockFinanceOverview())
  return railsRequest('GET', '/finance/overview', FinanceOverviewSchema)
}

export async function fetchFinanceRecurring(): Promise<FinanceRecurringPayment[]> {
  if (shouldMock('finance')) return mock(mockFinanceRecurring())
  const { recurringPayments } = await railsRequest('GET', '/finance/recurring_payments', FinanceRecurringCollectionSchema)
  return recurringPayments
}

export async function fetchFinanceBudgets(): Promise<FinanceBudget[]> {
  if (shouldMock('finance')) return mock(mockFinanceBudgets())
  const { budgets } = await railsRequest('GET', '/finance/budgets', FinanceBudgetCollectionSchema)
  return budgets
}

export async function fetchFinanceAccounts(): Promise<FinanceAccount[]> {
  if (shouldMock('finance')) return mock(mockFinanceAccounts())
  const { accounts } = await railsRequest('GET', '/finance/accounts', FinanceAccountCollectionSchema)
  return accounts
}

export async function fetchFinanceStatements(): Promise<FinanceStatement[]> {
  if (shouldMock('finance')) return mock([...mockFinanceStatements()])
  const { statements } = await railsRequest('GET', '/finance/statements', FinanceStatementCollectionSchema)
  return statements
}

/** One statement with its transactions. */
export async function fetchFinanceStatement(id: number): Promise<FinanceStatement> {
  if (shouldMock('finance')) {
    const found = mockFinanceStatements().find((s) => s.id === id)
    if (!found) throw new RailsError('That record is not on the server.', 404, 'not_found')
    return mock(found)
  }
  return railsRequest('GET', `/finance/statements/${id}`, FinanceStatementSchema)
}

/**
 * Upload a statement PDF. The server answers at once with the statement (`uploaded`) and reads it in the
 * background: poll `fetchFinanceStatement` until it is `review` or `failed`. The password, if any, is used
 * once by the server and never kept.
 */
export async function uploadFinanceStatement(accountId: number, file: File, password: string): Promise<FinanceStatement> {
  if (shouldMock('finance')) return mock(mockFinanceUpload(accountId, file.name))
  const form = new FormData()
  form.append('accountId', String(accountId))
  form.append('file', file)
  if (password) form.append('password', password)
  return railsUpload('/finance/statements', FinanceStatementSchema, form)
}

/** Accept a reviewed statement: its lines now count, and its closing balance is the account's latest balance. */
export async function confirmFinanceStatement(id: number): Promise<FinanceStatement> {
  if (shouldMock('finance')) return mock(mockFinanceConfirm(id))
  return railsRequest('POST', `/finance/statements/${id}/confirm`, FinanceStatementSchema, {})
}

/** Read a failed statement again. */
export async function retryFinanceStatement(id: number): Promise<FinanceStatement> {
  if (shouldMock('finance')) return mock(mockFinanceStatements().find((s) => s.id === id) as FinanceStatement)
  return railsRequest('POST', `/finance/statements/${id}/retry`, FinanceStatementSchema, {})
}

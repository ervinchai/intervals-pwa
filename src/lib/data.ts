import { getConfig, type MockEndpoint } from '@/lib/config'
import {
  BriefingSchema,
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
import { MOCK_BRIEFING, MOCK_MEAL_PLAN, MOCK_RECIPES } from '@/mock/data'

import type { BeanStatus } from '@/lib/coffee-utils'
import { errorFrom, RailsError, railsRequest } from '@/lib/rails'
import { readSse } from '@/lib/sse'

import type { ZodType } from 'zod'

/**
 * The single seam between screens and the backend. Screens call these and never
 * know whether the bytes came from Windmill or from a fixture, so wiring up real
 * endpoints is a config flip rather than a screen rewrite.
 *
 * Each endpoint maps to one Windmill script, run synchronously via the
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

/**
 * Coffee goes to the Rails API whenever `railsBaseUrl` is set, and to the Windmill scripts
 * otherwise. The Windmill path is the fallback while the Rails one is being proven; it goes
 * when the Windmill coffee scripts are retired.
 */
function coffeeOnRails(): boolean {
  return Boolean(getConfig().railsBaseUrl)
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
  if (coffeeOnRails()) return railsRequest('GET', '/coffee/beans', CoffeeCollectionSchema)
  return runScript('intervals/beans', {}, CoffeeCollectionSchema)
}

/** One bean plus its brew-log history, addressed by its Bean ID / QR code. */
export async function fetchCoffeeBean(id: string): Promise<CoffeeBean> {
  if (shouldMock('coffee')) {
    const bean = mockBean(id)
    if (!bean) throw new Error(`No mock bean "${id}"`)
    return mock(bean)
  }
  if (coffeeOnRails()) {
    return railsRequest('GET', `/coffee/beans/${encodeURIComponent(id)}`, CoffeeBeanSchema)
  }
  return runScript('intervals/bean', { id }, CoffeeBeanSchema)
}

/** Append a calibration entry to a bean's brew log. */
export async function logBrew(input: BrewLogInput): Promise<BrewLogEntry> {
  if (shouldMock('coffee')) return mock(mockLogBrew(input))
  if (coffeeOnRails()) {
    // The bean is in the path, so it is not repeated in the body.
    const { beanId, ...fields } = input
    return railsRequest('POST', `/coffee/beans/${encodeURIComponent(beanId)}/brews`, BrewLogEntrySchema, fields)
  }
  return runScript('intervals/brew_create', { ...input }, BrewLogEntrySchema)
}

/**
 * The scale's record of a logged brew, for its overview, or null when the scale did not read it (logged by
 * hand, or before shots were kept). Rails only; mock mode has none.
 */
export async function fetchShotRecord(beanId: string, brewId: string): Promise<ShotRecord | null> {
  if (shouldMock('coffee') || !coffeeOnRails()) return null
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
  if (shouldMock('coffee') || !coffeeOnRails()) return null
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
  if (coffeeOnRails()) {
    return railsRequest('PATCH', `/coffee/beans/${encodeURIComponent(beanId)}/target`, CoffeeBeanSchema, { brewId })
  }
  return runScript('intervals/set_target_brew', { beanId, brewId }, CoffeeBeanSchema)
}

/** Set a bag's status (Sealed, Open or Finished); returns the refreshed bean. */
export async function setBeanStatus(beanId: string, status: BeanStatus): Promise<CoffeeBean> {
  if (shouldMock('coffee')) return mock(mockSetBeanStatus(beanId, status))
  if (coffeeOnRails()) {
    return railsRequest('PATCH', `/coffee/beans/${encodeURIComponent(beanId)}`, CoffeeBeanSchema, { status })
  }
  // There never was a Windmill script for this.
  throw new Error('Changing a bag’s status needs the Rails API.')
}

/** Catalog a new bean; returns the created summary (Bean ID assigned by Notion). */
export async function createBean(input: BeanCreateInput): Promise<CoffeeBeanSummary> {
  if (shouldMock('coffee')) return mock(mockCreateBean(input))
  if (coffeeOnRails()) return railsRequest('POST', '/coffee/beans', CoffeeBeanSummarySchema, input)
  return runScript('intervals/bean_create', { ...input }, CoffeeBeanSummarySchema)
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

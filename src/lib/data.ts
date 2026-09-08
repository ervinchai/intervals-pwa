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
  type BeanCreateInput,
  type Briefing,
  type BrewLogEntry,
  type BrewLogInput,
  type CoffeeBean,
  type CoffeeBeanSummary,
  type CoffeeCollection,
  type MealPlan,
  type PrintLabelInput,
  type PrintResult,
  PrintResultSchema,
  type PrinterStatus,
  PrinterStatusSchema,
  type Recipe,
  type RecipeCollection,
} from '@/lib/contracts'
import {
  mockBean,
  mockBeanList,
  mockCreateBean,
  mockLogBrew,
  mockSetTargetBrew,
} from '@/mock/coffee'
import { MOCK_BRIEFING, MOCK_MEAL_PLAN, MOCK_RECIPES } from '@/mock/data'

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
  return runScript('intervals/beans', {}, CoffeeCollectionSchema)
}

/** One bean plus its brew-log history, addressed by its Bean ID / QR code. */
export async function fetchCoffeeBean(id: string): Promise<CoffeeBean> {
  if (shouldMock('coffee')) {
    const bean = mockBean(id)
    if (!bean) throw new Error(`No mock bean "${id}"`)
    return mock(bean)
  }
  return runScript('intervals/bean', { id }, CoffeeBeanSchema)
}

/** Append a calibration entry to a bean's brew log. */
export async function logBrew(input: BrewLogInput): Promise<BrewLogEntry> {
  if (shouldMock('coffee')) return mock(mockLogBrew(input))
  return runScript('intervals/brew_create', { ...input }, BrewLogEntrySchema)
}

/** Mark a brew as a bean's target (dialed-in) recipe; returns the updated bean. */
export async function setTargetBrew(beanId: string, brewId: string): Promise<CoffeeBean> {
  if (shouldMock('coffee')) return mock(mockSetTargetBrew(beanId, brewId))
  return runScript('intervals/set_target_brew', { beanId, brewId }, CoffeeBeanSchema)
}

/** Catalog a new bean; returns the created summary (Bean ID assigned by Notion). */
export async function createBean(input: BeanCreateInput): Promise<CoffeeBeanSummary> {
  if (shouldMock('coffee')) return mock(mockCreateBean(input))
  return runScript('intervals/bean_create', { ...input }, CoffeeBeanSummarySchema)
}

/**
 * Send a rendered label to the Niimbot printer via the backend.
 *
 * The Windmill script (`intervals/print_label`) holds the HA credentials and
 * maps this generic payload onto the actual Home Assistant service call — the
 * PWA never touches the HA token, and the exact service name lives server-side
 * so it can change without a client redeploy. This is an action, not a resource,
 * so it isn't in `mockOverrides`; in mock mode it just resolves ok, letting the
 * button be exercised without a live backend.
 */
export async function printLabel(input: PrintLabelInput): Promise<PrintResult> {
  if (getConfig().useMockData) return mock({ ok: true })
  return runScript('intervals/print_label', { ...input }, PrintResultSchema)
}

/**
 * Read the printer's live Bluetooth connectivity from the backend (which mirrors
 * a Home Assistant sensor). The print flow polls this while a print is in flight
 * — `printLabel` only resolves once the job finishes — to reflect the
 * connecting → printing handoff. Like {@link printLabel} it's an action-adjacent
 * read, not a cached resource, so it's gated on `useMockData` rather than
 * `mockOverrides`; in mock mode it reports connected so the flow still advances.
 */
export async function fetchPrinterStatus(): Promise<PrinterStatus> {
  if (getConfig().useMockData) return mock({ connected: true })
  return runScript('intervals/printer_status', {}, PrinterStatusSchema)
}

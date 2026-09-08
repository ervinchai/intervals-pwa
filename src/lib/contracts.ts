import { z } from 'zod'

/**
 * Response contracts for the Intervals backend (Windmill) endpoints.
 *
 * The backend returns *data*, never UI. These schemas are the agreed shape of that
 * data; validating in dev catches a drifted workflow at the boundary instead of
 * as a blank screen on the wall.
 */

export const IngredientSchema = z.object({
  id: z.string(),
  /** Full display line, e.g. "2 tbsp olive oil". */
  text: z.string(),
  /** Optional split-out amount, shown right-aligned when present. */
  amount: z.string().optional(),
  /**
   * Optional sub-group heading this ingredient sits under, e.g. "Marinade".
   * Ungrouped items (no heading) leave this unset and render first. Consecutive
   * items sharing a group are shown beneath one subheading in the checklist.
   */
  group: z.string().optional(),
})

export const RecipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  imageUrl: z.string().optional(),
  /** Total time, minutes. */
  timeMinutes: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  cuisine: z.string().optional(),
  ingredients: z.array(IngredientSchema),
  /** Mise en place — chopping, measuring, marinating. Shown on the Prep tab. */
  prepSteps: z.array(z.string()),
  /** The method proper — the heat-on cooking. Shown on the Cook tab. */
  cookSteps: z.array(z.string()),
  /**
   * Free-form notes — tips, substitutions, the "why". Shown on the Prep tab
   * below the method. Defaults to empty so a workflow that predates the field
   * still satisfies the contract.
   */
  notes: z.array(z.string()).default([]),
})

/**
 * Lightweight recipe entry for the collection grid — no ingredients or steps,
 * so listing every recipe stays cheap. The full body is fetched on selection.
 */
export const RecipeSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  imageUrl: z.string().optional(),
  timeMinutes: z.number().int().positive().optional(),
  servings: z.number().int().positive().optional(),
  cuisine: z.string().optional(),
})

export const RecipeCollectionSchema = z.object({
  recipes: z.array(RecipeSummarySchema),
})

export const MealSchema = z.object({
  /** breakfast | lunch | dinner | etc. Free-form so the backend owns the vocabulary. */
  slot: z.string(),
  recipeId: z.string(),
  title: z.string(),
  imageUrl: z.string().optional(),
})

export const MealPlanDaySchema = z.object({
  /** ISO date, YYYY-MM-DD. */
  date: z.string(),
  meals: z.array(MealSchema),
})

export const MealPlanSchema = z.object({
  days: z.array(MealPlanDaySchema),
})

export const WeatherSchema = z.object({
  temperature: z.number(),
  condition: z.string(),
  high: z.number().optional(),
  low: z.number().optional(),
})

export const CalendarEventSchema = z.object({
  id: z.string(),
  /** Display time, pre-formatted by the backend — the hub does no timezone maths. */
  time: z.string(),
  title: z.string(),
  location: z.string().optional(),
})

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
})

export const BriefingSchema = z.object({
  /** Pre-formatted greeting line, e.g. "Sunday, 26 July". */
  dateLabel: z.string(),
  weather: WeatherSchema.optional(),
  events: z.array(CalendarEventSchema),
  tasks: z.array(TaskSchema),
  /**
   * Today's meals only — not the week.
   *
   * the backend picks the current day out of the plan so the hub never fetches seven
   * days to display one. Defaults to empty so an older workflow that predates
   * this field still satisfies the contract.
   */
  meals: z.array(MealSchema).default([]),
})

/**
 * Coffee — a bean catalog backed by a Notion database, plus a per-bean brew
 * calibration log. The backend flattens Notion's property model into these
 * shapes; the hub never sees Notion's rich-property JSON.
 */

/** Roast/brew vocabularies. Kept as plain strings — the Notion DB owns the
 *  authoritative option list, so a new option there never breaks the contract. */
export const BrewResultSchema = z.enum(['Sour / Under', 'Balanced', 'Bitter / Over'])

/** One dial-in entry against a bean. */
export const BrewLogEntrySchema = z.object({
  id: z.string(),
  /** ISO-8601 timestamp (Notion page `created_time`); the hub formats it for display. */
  createdAt: z.string(),
  method: z.string(),
  /** Grinder setting, free-form (clicks, numbers). */
  grind: z.string().optional(),
  doseG: z.number().optional(),
  yieldG: z.number().optional(),
  timeS: z.number().optional(),
  waterTempC: z.number().optional(),
  /** Yield ÷ dose, computed by Notion; shown as e.g. 2.1 for a 1:2.1 ratio. */
  ratio: z.number().optional(),
  result: BrewResultSchema.optional(),
  /** What to change on the next brew. */
  adjustment: z.string().optional(),
  notes: z.string().optional(),
  /** True when this brew is the bean's target recipe (Notion "Referenced by" set). */
  isTarget: z.boolean().default(false),
})

/** Lightweight bean entry for the catalog grid. */
export const CoffeeBeanSummarySchema = z.object({
  /** The Notion "Bean ID" (e.g. "BN-12"); also the QR identity. */
  id: z.string(),
  name: z.string(),
  roaster: z.string().optional(),
  origin: z.string().optional(),
  roastLevel: z.string().optional(),
  /** ISO calendar date (yyyy-mm-dd); the hub formats it for display. */
  roastDate: z.string().optional(),
  status: z.string().optional(),
  process: z.string().optional(),
  weightG: z.number().optional(),
  /** The current dialed-in brew — grind / dose / yield / time as one line. */
  targetRecipe: z.string().optional(),
})

/** Full bean detail, including its brew-log history. */
export const CoffeeBeanSchema = CoffeeBeanSummarySchema.extend({
  region: z.string().optional(),
  producer: z.string().optional(),
  varietal: z.string().optional(),
  altitude: z.string().optional(),
  /** ISO calendar date (yyyy-mm-dd); the hub formats it for display. */
  purchaseDate: z.string().optional(),
  price: z.number().optional(),
  tastingNotes: z.string().optional(),
  brewMethods: z.array(z.string()).default([]),
  brews: z.array(BrewLogEntrySchema).default([]),
})

export const CoffeeCollectionSchema = z.object({
  beans: z.array(CoffeeBeanSummarySchema),
})

/** What the "Log a shot" form sends to create a brew entry. */
export const BrewLogInputSchema = z.object({
  beanId: z.string(),
  method: z.string(),
  grind: z.string().optional(),
  doseG: z.number().optional(),
  yieldG: z.number().optional(),
  timeS: z.number().optional(),
  waterTempC: z.number().optional(),
  result: BrewResultSchema.optional(),
  adjustment: z.string().optional(),
  notes: z.string().optional(),
})

/**
 * What the "New bean" form sends to catalog a bag. The backend assigns the Bean
 * ID (Notion auto-increment) and formats the date labels, so neither is sent.
 * `roastDate`/`purchaseDate` are plain ISO calendar dates (yyyy-mm-dd).
 */
export const BeanCreateInputSchema = z.object({
  name: z.string().min(1),
  roaster: z.string().optional(),
  origin: z.string().optional(),
  region: z.string().optional(),
  producer: z.string().optional(),
  process: z.string().optional(),
  varietal: z.string().optional(),
  altitude: z.string().optional(),
  roastLevel: z.string().optional(),
  roastDate: z.string().optional(),
  purchaseDate: z.string().optional(),
  weightG: z.number().optional(),
  price: z.number().optional(),
  tastingNotes: z.string().optional(),
  // Target Recipe is a Brew Log relation set from an existing brew, not typed here.
  brewMethods: z.array(z.string()).default([]),
  status: z.string().optional(),
})

/**
 * A label-print request sent to the backend. `imageBase64` is the raw base64 of
 * the 555×360 PNG (no `data:` prefix) — the only thing the printer consumes. */
export const PrintLabelInputSchema = z.object({
  imageBase64: z.string(),
})

/** Result of a print request. `ok` is the only field screens depend on. */
export const PrintResultSchema = z.object({
  ok: z.boolean(),
  detail: z.string().optional(),
})

/**
 * Live printer connectivity, mirrored from Home Assistant. Since a print blocks
 * until it finishes, the print flow polls this to show the connect → print step;
 * `connected` is the only field the UI reads. */
export const PrinterStatusSchema = z.object({
  connected: z.boolean(),
  detail: z.string().optional(),
})

export type Ingredient = z.infer<typeof IngredientSchema>
export type Recipe = z.infer<typeof RecipeSchema>
export type RecipeSummary = z.infer<typeof RecipeSummarySchema>
export type RecipeCollection = z.infer<typeof RecipeCollectionSchema>
export type Meal = z.infer<typeof MealSchema>
export type MealPlanDay = z.infer<typeof MealPlanDaySchema>
export type MealPlan = z.infer<typeof MealPlanSchema>
export type Weather = z.infer<typeof WeatherSchema>
export type CalendarEvent = z.infer<typeof CalendarEventSchema>
export type Task = z.infer<typeof TaskSchema>
export type Briefing = z.infer<typeof BriefingSchema>
export type BrewResult = z.infer<typeof BrewResultSchema>
export type BrewLogEntry = z.infer<typeof BrewLogEntrySchema>
export type CoffeeBeanSummary = z.infer<typeof CoffeeBeanSummarySchema>
export type CoffeeBean = z.infer<typeof CoffeeBeanSchema>
export type CoffeeCollection = z.infer<typeof CoffeeCollectionSchema>
export type BrewLogInput = z.infer<typeof BrewLogInputSchema>
export type BeanCreateInput = z.infer<typeof BeanCreateInputSchema>
export type PrintLabelInput = z.infer<typeof PrintLabelInputSchema>
export type PrintResult = z.infer<typeof PrintResultSchema>
export type PrinterStatus = z.infer<typeof PrinterStatusSchema>

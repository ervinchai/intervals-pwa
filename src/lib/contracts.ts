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

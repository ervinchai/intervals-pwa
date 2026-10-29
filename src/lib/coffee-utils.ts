/**
 * Days since roast, from the bean's raw ISO roast date against today's date.
 *
 * Both sides are reduced to their UTC calendar date before diffing — the
 * backend's date-only ISO string (e.g. "2026-09-02") parses as UTC midnight,
 * so comparing it against `today`'s *local* getters would drift a day near
 * midnight in non-UTC timezones.
 */
export function daysOffRoast(
  isoDate: string | null | undefined,
  todayISO: string = new Date().toISOString(),
): number | null {
  if (!isoDate) return null
  const roasted = new Date(isoDate)
  if (Number.isNaN(roasted.getTime())) return null
  const today = new Date(todayISO)
  const roastedUTC = Date.UTC(roasted.getUTCFullYear(), roasted.getUTCMonth(), roasted.getUTCDate())
  const todayUTC = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((todayUTC - roastedUTC) / 86400000)
}

/** Format an ISO date (or timestamp) as the hub's short display label, e.g. "08/09". */
export function formatShortDate(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const day = String(d.getUTCDate()).padStart(2, '0')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

/** Format an ISO timestamp as a 12h clock time, e.g. "2:32pm" — the local time it happened. */
export function formatClockTime(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  const hours24 = d.getHours()
  const period = hours24 >= 12 ? 'pm' : 'am'
  const hours12 = hours24 % 12 || 12
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `${hours12}:${minutes}${period}`
}

/** Format a brew's pull time in seconds as e.g. "29s" or "1m50s" (whole minutes: "2m"). */
export function formatBrewTime(seconds: number | null | undefined): string | undefined {
  if (seconds == null) return undefined
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}m` : `${m}m${s}s`
}

/** Freshness band -> a tone. Espresso wants a rest; past three weeks it fades. */
export function freshness(days: number | null) {
  if (days == null) return { tone: 'neutral' as const, text: '—', note: '' }
  if (days < 5) return { tone: 'neutral' as const, text: `${days}d off roast`, note: 'resting' }
  if (days <= 21) return { tone: 'sage' as const, text: `${days}d off roast`, note: 'in window' }
  return { tone: 'clay' as const, text: `${days}d off roast`, note: 'past peak' }
}

/**
 * Freshness-curve milestones (days off roast) for a roast level, from the
 * general home-espresso convention: `peakStart`/`peakEnd` bound the window
 * the bean tastes best in, and `stale` is when it's past worth drinking (the
 * "Flat (Fading)" period between `peakEnd` and `stale` is the falling-off
 * stretch in between — not a separate milestone of its own). Values below
 * are days converted from that convention's day/week ranges (using each
 * range's low end for peakStart/peakEnd and the week threshold for stale);
 * denser, oilier dark roasts degas and stale faster than light roasts, hence
 * the compressed curves down the list.
 */
const ROAST_CURVES: Record<string, { peakStart: number; peakEnd: number; stale: number }> = {
  Light: { peakStart: 14, peakEnd: 35, stale: 56 },
  'Medium-Light': { peakStart: 10, peakEnd: 28, stale: 42 },
  Medium: { peakStart: 7, peakEnd: 21, stale: 35 },
  'Medium-Dark': { peakStart: 5, peakEnd: 14, stale: 28 },
  Dark: { peakStart: 3, peakEnd: 10, stale: 21 },
}

/** The freshness curve for a roast level, falling back to Medium's when unset/unrecognized. */
export function roastCurve(
  roastLevel: string | null | undefined,
): { peakStart: number; peakEnd: number; stale: number } {
  return (roastLevel && ROAST_CURVES[roastLevel]) || ROAST_CURVES.Medium
}

/** The target string "2.5 · 18g in · 38g out · 28s" split into named parts */
export function parseTarget(target: string | null | undefined) {
  if (!target) return null
  const parts = target.split('·').map((s) => s.trim())
  return { grind: parts[0], dose: parts[1], yield: parts[2], time: parts[3] }
}

/** The yield of a target recipe in grams ("38g out" gives 38), or null when there is none. */
export function targetYieldG(target: string | null | undefined): number | null {
  const parsed = parseTarget(target)
  if (!parsed?.yield) return null
  const grams = Number.parseFloat(parsed.yield)
  return Number.isFinite(grams) ? grams : null
}

/**
 * The cup profile axes — descriptive 1–5 continuums recorded alongside Result.
 * Shared between the entry form (BrewSession) and the log readout (BeanView)
 * so the labels/endpoints never drift between the two.
 */
export const CUP_AXES = [
  { key: 'body', label: 'Body', low: 'Thin', high: 'Full' },
  { key: 'sweetness', label: 'Sweetness', low: 'Low', high: 'High' },
  { key: 'acidity', label: 'Acidity', low: 'Low', high: 'High' },
  { key: 'aftertaste', label: 'Aftertaste', low: 'Short', high: 'Lingering' },
] as const

/** The statuses of a bag, as the API accepts them. */
export const BEAN_STATUSES = ['Sealed', 'Open', 'Finished'] as const
export type BeanStatus = (typeof BEAN_STATUSES)[number]

/**
 * The one step a bag can take from where it is: a sealed bag is opened, an open one is
 * finished, and a finished one can be reopened (it was marked by mistake, or it turned up
 * again). A bag with no status is treated as sealed.
 */
export function nextStatusAction(status: string | null | undefined): { label: string; status: BeanStatus } {
  switch (status) {
    case 'Open':
      return { label: 'Finish bag', status: 'Finished' }
    case 'Finished':
      return { label: 'Reopen bag', status: 'Open' }
    default:
      return { label: 'Open bag', status: 'Open' }
  }
}

/** The first number in a string ("38g out" gives 38, "2.9" gives 2.9), or null when there is none. */
export function numberIn(text: string | null | undefined): number | null {
  const match = (text ?? '').match(/-?\d+(\.\d+)?/)
  return match ? Number(match[0]) : null
}

/** How far a suggested grind change moves the dial. */
export const GRIND_STEP = 0.2

export type GrindAdvice = {
  /** The grind setting to try. */
  grind: number
  direction: 'finer' | 'coarser'
  /** Why, in a few words, for the screen: "Last shot was sour". */
  reason: string
}

/**
 * A grind setting to try next, from how the last shot turned out. A sour or under-extracted shot
 * wants a finer grind and a bitter or over-extracted one a coarser grind; a balanced shot, or one
 * with no result recorded, gets no suggestion. It moves from the setting that shot was pulled at
 * (or the recipe's when the log did not keep one) by `GRIND_STEP`.
 *
 * This assumes a lower number is a finer grind, as on most grinders. If yours counts the other way,
 * swap `finer` and `coarser` here.
 */
export function suggestGrind(
  last: { grind?: string | null; result?: string | null } | null | undefined,
  recipeGrind: number | null | undefined,
): GrindAdvice | null {
  const direction = last?.result === 'Sour / Under' ? 'finer' : last?.result === 'Bitter / Over' ? 'coarser' : null
  if (!direction) return null
  const from = numberIn(last?.grind) ?? recipeGrind ?? null
  if (from === null) return null
  const grind = Math.max(0, Math.round((from + (direction === 'finer' ? -GRIND_STEP : GRIND_STEP)) * 10) / 10)
  return { grind, direction, reason: direction === 'finer' ? 'Last shot was sour' : 'Last shot was bitter' }
}

/**
 * Where the grind dial starts. With a suggestion it starts at the setting the last shot was pulled
 * at, so the suggested change is a move from what the dial shows. Without one it starts at the
 * recipe's setting, then the last shot's, then 3.
 */
export function startingGrind(
  advice: GrindAdvice | null,
  last: { grind?: string | null } | null | undefined,
  recipeGrind: number | null | undefined,
): number {
  const lastGrind = numberIn(last?.grind)
  return (advice ? (lastGrind ?? recipeGrind) : (recipeGrind ?? lastGrind)) ?? 3
}

/** How a bean is brewed: only as espresso, only as filter, or either. */
export type BrewKind = 'espresso' | 'filter' | 'both'

/**
 * How a bean is brewed, from its roast profile (the bean's `brewMethods`: Espresso,
 * Filter, Omniroast). Omniroast means either, and so does a bean tagged both, or tagged with neither
 * (or nothing at all), because then there is nothing to say which it is.
 */
export function brewKind(methods: readonly string[] | null | undefined): BrewKind {
  const tags = new Set(methods ?? [])
  const espresso = tags.has('Espresso')
  const filter = tags.has('Filter')
  if (tags.has('Omniroast') || espresso === filter) return 'both'
  return espresso ? 'espresso' : 'filter'
}

/**
 * The method the brew log opens on. An espresso bean is an espresso. Anything else opens on V60, the
 * usual filter method: the log's methods are Espresso, V60, AeroPress, French Press, Moka and Cold
 * Brew, and the bean's tag "Filter" is none of them.
 */
export function defaultBrewMethod(kind: BrewKind): string {
  return kind === 'espresso' ? 'Espresso' : 'V60'
}

const BREW_TEMP_KEY = 'intervals:brew:lastTempC'
const DEFAULT_BREW_TEMP_C = 93

/** The water temperature used last time, in °C, kept on this device. */
export function lastBrewTemp(): number {
  try {
    const stored = parseInt(localStorage.getItem(BREW_TEMP_KEY) ?? '', 10)
    return Number.isNaN(stored) ? DEFAULT_BREW_TEMP_C : stored
  } catch {
    return DEFAULT_BREW_TEMP_C
  }
}

export function saveBrewTemp(celsius: number) {
  try {
    localStorage.setItem(BREW_TEMP_KEY, String(celsius))
  } catch {
    // Private mode or blocked storage: the next brew just starts from the default.
  }
}

/** A shot or brew time as a clock: "28s" under a minute, "1:05" after. */
export function formatShotClock(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

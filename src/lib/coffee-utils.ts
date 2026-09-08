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

/**
 * Days since roast, derived from the backend's short label (e.g., "2 Sep") against today's date.
 */
export function daysOffRoast(
  label: string | null | undefined,
  todayISO: string = new Date().toISOString(),
): number | null {
  if (!label) return null
  const today = new Date(todayISO)
  const d = new Date(label + ' ' + today.getFullYear())
  if (Number.isNaN(d.getTime())) return null
  if (d > today) d.setFullYear(d.getFullYear() - 1)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

/** Freshness band -> a tone. Espresso wants a rest; past three weeks it fades. */
export function freshness(days: number | null) {
  if (days == null) return { tone: 'neutral' as const, text: '—', note: '' }
  if (days < 5) return { tone: 'neutral' as const, text: `${days}d off roast`, note: 'resting' }
  if (days <= 21) return { tone: 'sage' as const, text: `${days}d off roast`, note: 'in window' }
  return { tone: 'clay' as const, text: `${days}d off roast`, note: 'past peak' }
}

/** The target string "2.5 · 18g in · 38g out · 28s" split into named parts */
export function parseTarget(target: string | null | undefined) {
  if (!target) return null
  const parts = target.split('·').map((s) => s.trim())
  return { grind: parts[0], dose: parts[1], yield: parts[2], time: parts[3] }
}

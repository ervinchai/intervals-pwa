/**
 * A moment on the graph the AI pointed at: `atS` seconds since the trace's start, `id` the number shown on it.
 * With `untilS` it is a stretch, drawn as a band from `atS` to `untilS`.
 */
export type FlowMark = { id: number; atS: number; untilS?: number | null; label?: string | null; tone: 'good' | 'info' | 'minor' | 'major' }

/** The fill of a mark, by how much it matters: green for good, ember and clay for the things to fix. */
export const MARK_TONE: Record<FlowMark['tone'], string> = {
  good: 'bg-sage',
  info: 'bg-ink-faint',
  minor: 'bg-ember',
  major: 'bg-clay',
}

/** The same colours as MARK_TONE, for the SVG band behind the line. */
export const MARK_COLOR: Record<FlowMark['tone'], string> = {
  good: 'var(--color-sage)',
  info: 'var(--color-ink-faint)',
  minor: 'var(--color-ember)',
  major: 'var(--color-clay)',
}

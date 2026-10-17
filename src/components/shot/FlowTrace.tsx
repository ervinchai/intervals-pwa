import { MARK_COLOR, MARK_TONE, type FlowMark } from '@/components/shot/marks'
import { cn } from '@/lib/cn'

/** The flow rate over a stretch of time from `start`, `windowMs` long, drawn as a line with a flat tint under it. */
export type Trace = { start: number; windowMs: number; points: Array<{ t: number; f: number }> }

const WIDTH = 600
const HEIGHT = 100
/** The spacing of the time marks counted from the timer's start, in milliseconds. */
const TICK_MS = 10_000

type Point = [number, number]

/**
 * An SVG path through the points (x ascending). Straight segments, or with `curved` a monotone cubic
 * (Fritsch-Carlson): a smooth curve whose slope at each point is the mean of the two around it, cut back so
 * it never rises above a peak or falls below a dip in the data.
 */
function pathOf(points: Point[], curved: boolean): string {
  const at = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`
  if (!curved || points.length < 3) return `M${points.map(at).join(' L')}`
  const gaps = points.slice(1).map(([x], i) => x - points[i][0])
  const slopes = points.slice(1).map(([, y], i) => (gaps[i] > 0 ? (y - points[i][1]) / gaps[i] : 0))
  const tangents = points.map((_, i) => {
    if (i === 0) return slopes[0]
    if (i === points.length - 1) return slopes[i - 1]
    return slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2
  })
  slopes.forEach((slope, i) => {
    if (slope === 0) {
      tangents[i] = 0
      tangents[i + 1] = 0
      return
    }
    const a = tangents[i] / slope
    const b = tangents[i + 1] / slope
    const size = a * a + b * b
    if (size > 9) {
      const scale = 3 / Math.sqrt(size)
      tangents[i] = scale * a * slope
      tangents[i + 1] = scale * b * slope
    }
  })
  const segments = slopes.map((_, i) => {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const third = gaps[i] / 3
    return `C${at([x0 + third, y0 + tangents[i] * third])} ${at([x1 - third, y1 - tangents[i + 1] * third])} ${at([x1, y1])}`
  })
  return `M${at(points[0])} ${segments.join(' ')}`
}

/**
 * The flow rate over the trace's window as a line from 0 up to `maxFlow` g/s, with a guide at each
 * whole g/s. A pulled shot has a recognisable shape (nothing, a quick rise, a plateau), so a
 * glance says whether this one is going the way the last did.
 *
 * With `origin` (when the shot timer started, on the trace's clock) the time axis is the shot's: a solid
 * mark at the start and a dashed one every 10 s after it, labelled in seconds, so the graph and the timer
 * read as one.
 *
 * `curved` draws the line as a smooth curve through the points (monotone, so it never swings above a peak or
 * below a dip that is not in the data) instead of straight segments: for a flow that has been smoothed.
 *
 * `marks` are numbered dots set on the line where the AI saw something (the number is the one beside its
 * finding). Tapping one calls `onMark`; the `activeMark` gets a ring and a guide line down to the time axis.
 */
export function FlowTrace({
  trace,
  maxFlow,
  origin = null,
  curved = false,
  marks = [],
  activeMark = null,
  onMark,
}: {
  trace: Trace | null
  maxFlow: number
  origin?: number | null
  curved?: boolean
  marks?: FlowMark[]
  activeMark?: number | null
  onMark?: (id: number) => void
}) {
  const pt = (t: number, f: number): Point => [
    ((t - (trace?.start ?? 0)) / (trace?.windowMs ?? 1)) * WIDTH,
    HEIGHT - (Math.min(Math.max(f, 0), maxFlow) / maxFlow) * HEIGHT,
  ]
  const line = trace && trace.points.length > 1 ? pathOf(trace.points.map(({ t, f }) => pt(t, f)), curved) : ''
  const first = trace?.points[0]
  const last = trace?.points.at(-1)
  // The area under the line: along it, down to the baseline, back to where it began.
  const area = line && first && last ? `${line} L${pt(last.t, 0)[0].toFixed(1)},${HEIGHT} L${pt(first.t, 0)[0].toFixed(1)},${HEIGHT} Z` : ''
  const guides = Array.from({ length: Math.floor(maxFlow) }, (_, i) => i + 1)
  // The time marks inside the window, as fractions of its width, with the seconds since the timer started.
  const ticks: Array<{ x: number; seconds: number }> = []
  if (trace && origin !== null) {
    const end = trace.start + trace.windowMs
    for (let t = origin; t <= end; t += TICK_MS) {
      if (t >= trace.start) ticks.push({ x: (t - trace.start) / trace.windowMs, seconds: Math.round((t - origin) / 1000) })
    }
  }

  // Where each mark sits: along the window by its time, and on the line at the flow nearest that time.
  const placed = trace
    ? marks.flatMap((mark) => {
        // A stretch is marked at its middle and shaded from its start to its end.
        const from = (mark.atS * 1000) / trace.windowMs
        const to = mark.untilS ? Math.min((mark.untilS * 1000) / trace.windowMs, 1) : from
        const x = (from + to) / 2
        if (from < 0 || from > 1 || trace.points.length === 0) return []
        const t = trace.start + x * trace.windowMs
        const nearest = trace.points.reduce((best, point) => (Math.abs(point.t - t) < Math.abs(best.t - t) ? point : best))
        const y = 1 - Math.min(Math.max(nearest.f, 0), maxFlow) / maxFlow
        return [{ ...mark, x, y, from, to }]
      })
    : []
  const active = placed.find((mark) => mark.id === activeMark)

  return (
    <div className="relative h-full min-h-0 w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`Flow rate over ${Math.round((trace?.windowMs ?? 0) / 1000)} seconds`}
      >
        {guides.map((g) => (
          <line
            key={g}
            x1="0"
            x2={WIDTH}
            y1={HEIGHT - (g / maxFlow) * HEIGHT}
            y2={HEIGHT - (g / maxFlow) * HEIGHT}
            stroke="var(--color-line)"
            strokeWidth="1"
            strokeDasharray="3 6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <line x1="0" x2={WIDTH} y1={HEIGHT} y2={HEIGHT} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {ticks.map(({ x, seconds }) => (
          <line
            key={seconds}
            x1={x * WIDTH}
            x2={x * WIDTH}
            y1="0"
            y2={HEIGHT}
            stroke={seconds === 0 ? 'var(--color-ink-faint)' : 'var(--color-line)'}
            strokeWidth="1"
            strokeDasharray={seconds === 0 ? undefined : '3 6'}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {placed
          .filter((mark) => mark.to > mark.from)
          .map((mark) => (
            <rect
              key={mark.id}
              x={mark.from * WIDTH}
              width={(mark.to - mark.from) * WIDTH}
              y="0"
              height={HEIGHT}
              fill={MARK_COLOR[mark.tone]}
              fillOpacity={mark.id === activeMark ? 0.36 : activeMark === null ? 0.22 : 0.1}
            />
          ))}
        {active ? (
          <line
            x1={active.x * WIDTH}
            x2={active.x * WIDTH}
            y1={active.y * HEIGHT}
            y2={HEIGHT}
            stroke="var(--color-ink-dim)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {area ? <path d={area} fill="var(--color-ember)" fillOpacity="0.12" /> : null}
        {line ? (
          <path
            d={line}
            fill="none"
            stroke="var(--color-ember)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {/* The stretch itself is drawn over the line, thicker and in the finding's colour. */}
        {trace
          ? placed
              .filter((mark) => mark.to > mark.from)
              .map((mark) => {
                const lo = trace.start + mark.from * trace.windowMs
                const hi = trace.start + mark.to * trace.windowMs
                const stretch = trace.points.filter(({ t }) => t >= lo && t <= hi).map(({ t, f }) => pt(t, f))
                return stretch.length > 1 ? (
                  <path
                    key={mark.id}
                    d={pathOf(stretch, curved)}
                    fill="none"
                    stroke={MARK_COLOR[mark.tone]}
                    strokeOpacity={activeMark === null || mark.id === activeMark ? 1 : 0.45}
                    strokeWidth="5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null
              })
          : null}
      </svg>
      {/* Guide labels sit on the left edge, in HTML so they stay crisp as the chart stretches. */}
      {guides.map((g) => (
        <span
          key={g}
          className={cn(
            'absolute left-1 text-[0.6875rem] tabular-nums text-ink-faint',
            // The top guide's label would sit above the graph, on its header: it goes under its line instead.
            g < maxFlow && '-translate-y-full',
          )}
          style={{ top: `${100 - (g / maxFlow) * 100}%` }}
          aria-hidden
        >
          {g} g/s
        </span>
      ))}
      {/* A short name for each finding, along the top, so the notable parts read without the list. */}
      {placed.map((mark) =>
        mark.label ? (
          <button
            key={`label-${mark.id}`}
            type="button"
            onClick={() => onMark?.(mark.id)}
            tabIndex={-1}
            aria-hidden
            className={cn(
              'arrive absolute top-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-medium text-ember-text',
              MARK_TONE[mark.tone],
              mark.x < 0.12 ? '' : mark.x > 0.88 ? '-translate-x-full' : '-translate-x-1/2',
              mark.id === activeMark ? 'z-10 ring-2 ring-ink' : activeMark === null ? '' : 'opacity-60',
            )}
            style={{ left: `${(mark.x < 0.12 ? mark.from : mark.x > 0.88 ? mark.to : mark.x) * 100}%` }}
          >
            {mark.label}
          </button>
        ) : null,
      )}
      {placed.map((mark) => (
        <button
          key={mark.id}
          type="button"
          onClick={() => onMark?.(mark.id)}
          aria-label={`Finding ${mark.id} at ${Math.round(mark.atS)} seconds`}
          aria-pressed={mark.id === activeMark}
          className={cn(
            'arrive absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[0.6875rem] font-semibold tabular-nums text-ember-text',
            MARK_TONE[mark.tone],
            mark.id === activeMark ? 'z-10 ring-2 ring-ink' : 'ring-2 ring-base',
          )}
          style={{ left: `${mark.x * 100}%`, top: `${mark.y * 100}%` }}
        >
          {mark.id}
        </button>
      ))}
      {ticks.map(({ x, seconds }) => (
        <span
          key={seconds}
          className={cn('absolute bottom-0.5 text-[0.6875rem] tabular-nums text-ink-faint', x > 0.9 ? '-translate-x-full pr-1' : 'pl-1')}
          style={{ left: `${x * 100}%` }}
          aria-hidden
        >
          {seconds} s
        </span>
      ))}
    </div>
  )
}

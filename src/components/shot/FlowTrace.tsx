/** The flow rate over a stretch of time from `start`, `windowMs` long, drawn as a line with a flat tint under it. */
export type Trace = { start: number; windowMs: number; points: Array<{ t: number; f: number }> }

const WIDTH = 600
const HEIGHT = 100
/** The spacing of the time marks counted from the timer's start, in milliseconds. */
const TICK_MS = 10_000

/**
 * The flow rate over the trace's window as a line from 0 up to `maxFlow` g/s, with a guide at each
 * whole g/s. A pulled shot has a recognisable shape (nothing, a quick rise, a plateau), so a
 * glance says whether this one is going the way the last did.
 *
 * With `origin` (when the shot timer started, on the trace's clock) the time axis is the shot's: a solid
 * mark at the start and a dashed one every 10 s after it, labelled in seconds, so the graph and the timer
 * read as one.
 */
export function FlowTrace({ trace, maxFlow, origin = null }: { trace: Trace | null; maxFlow: number; origin?: number | null }) {
  const xy = (t: number, f: number) => {
    const x = ((t - (trace?.start ?? 0)) / (trace?.windowMs ?? 1)) * WIDTH
    const y = HEIGHT - (Math.min(Math.max(f, 0), maxFlow) / maxFlow) * HEIGHT
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }
  const line = trace && trace.points.length > 1 ? trace.points.map(({ t, f }) => xy(t, f)).join(' ') : ''
  const first = trace?.points[0]
  const last = trace?.points.at(-1)
  const area = line && first && last ? `${xy(first.t, 0)} ${line} ${xy(last.t, 0)}` : ''
  const guides = Array.from({ length: Math.floor(maxFlow) }, (_, i) => i + 1)
  // The time marks inside the window, as fractions of its width, with the seconds since the timer started.
  const ticks: Array<{ x: number; seconds: number }> = []
  if (trace && origin !== null) {
    const end = trace.start + trace.windowMs
    for (let t = origin; t <= end; t += TICK_MS) {
      if (t >= trace.start) ticks.push({ x: (t - trace.start) / trace.windowMs, seconds: Math.round((t - origin) / 1000) })
    }
  }

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
        {area ? <polygon points={area} fill="var(--color-ember)" fillOpacity="0.12" /> : null}
        {line ? (
          <polyline
            points={line}
            fill="none"
            stroke="var(--color-ember)"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {/* Guide labels sit on the left edge, in HTML so they stay crisp as the chart stretches. */}
      {guides.map((g) => (
        <span
          key={g}
          className="absolute left-1 -translate-y-full text-[0.6875rem] tabular-nums text-ink-faint"
          style={{ top: `${100 - (g / maxFlow) * 100}%` }}
          aria-hidden
        >
          {g} g/s
        </span>
      ))}
      {ticks.map(({ x, seconds }) => (
        <span
          key={seconds}
          className="absolute bottom-0.5 pl-1 text-[0.6875rem] tabular-nums text-ink-faint"
          style={{ left: `${x * 100}%` }}
          aria-hidden
        >
          {seconds} s
        </span>
      ))}
    </div>
  )
}

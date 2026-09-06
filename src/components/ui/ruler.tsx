import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Ruler slider — a horizontal tick scale you drag like a caliper or the collar
   markings on a grinder. Minor ticks every step, taller labelled ticks at each
   major interval, and an ember marker at the current value. Drag anywhere on
   the track; the pointer's x maps straight to the value. Tokenised, so it
   reskins with everything else.
--------------------------------------------------------------------------- */

type RulerSliderProps = {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Interval between tall, labelled ticks. */
  major?: number
  /** Draw the fine minor ticks only up to this value; above it, majors only.
   *  Lets the scale stay dense where fine adjustment matters (the espresso end)
   *  and go sparse where it doesn't. Omit to draw minors across the whole range. */
  minorUntil?: number
  /** Digits after the decimal in the readout. */
  precision?: number
  className?: string
}

export function RulerSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 10,
  step = 0.1,
  major = 1,
  minorUntil,
  precision = 1,
  className,
}: RulerSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => {
    const stepped = Math.round((v - min) / step) * step + min
    return clamp(Math.round(stepped * 1000) / 1000)
  }
  const frac = max > min ? (clamp(value) - min) / (max - min) : 0

  function valueFromPointer(e: ReactPointerEvent<HTMLDivElement>) {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    onChange(snap(min + f * (max - min)))
  }

  function handleDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    valueFromPointer(e)
  }

  function handleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.buttons === 0) return
    valueFromPointer(e)
  }

  const count = Math.max(1, Math.round((max - min) / step))
  const ticks = Array.from({ length: count + 1 }, (_, i) => {
    const v = min + i * step
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6
    return { v, isMajor, pos: (i / count) * 100 }
  }).filter((t) => t.isMajor || minorUntil == null || t.v <= minorUntil + 1e-6)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-faint">{label}</span>
        <span className="text-4xl font-semibold tabular-nums text-ink">
          {value.toFixed(precision)}
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        className="relative h-16 w-full cursor-ew-resize touch-none select-none"
      >
        {ticks.map((t, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'absolute bottom-5 w-px -translate-x-1/2',
              t.isMajor ? 'h-7 bg-ink-faint' : 'h-3.5 bg-line',
            )}
            style={{ left: `${t.pos}%` }}
          />
        ))}
        {ticks
          .filter((t) => t.isMajor)
          .map((t) => (
            <span
              key={`label-${t.v}`}
              aria-hidden
              className="absolute bottom-0 -translate-x-1/2 text-[0.7rem] tabular-nums text-ink-faint"
              style={{ left: `${t.pos}%` }}
            >
              {t.v.toFixed(0)}
            </span>
          ))}

        {/* Value marker */}
        <span
          aria-hidden
          className="absolute top-0 bottom-4 w-1 -translate-x-1/2 rounded-full bg-ember"
          style={{ left: `${frac * 100}%` }}
        />
      </div>
    </div>
  )
}

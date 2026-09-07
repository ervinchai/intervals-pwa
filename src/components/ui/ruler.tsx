import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Ruler slider — combines a scrubber readout with a visual collar ruler.
   The value is adjusted via the scrubber effect (relative horizontal dragging
   and flanking chevrons for single-step nudges), while the ruler beneath
   serves as a visual gauge to indicate the current value across the scale.
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
  /** Pixels of drag per step. Lower is faster/coarser. */
  pxPerStep?: number
  className?: string
}

export function RulerSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 16,
  step = 0.1,
  major = 1,
  minorUntil,
  precision = 1,
  pxPerStep = 10,
  className,
}: RulerSliderProps) {
  const start = useRef<{ x: number; value: number } | null>(null)
  const moved = useRef(false)
  const downDir = useRef<1 | -1 | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => {
    const stepped = Math.round((v - min) / step) * step + min
    return clamp(Math.round(stepped * 1000) / 1000)
  }
  const frac = max > min ? (clamp(value) - min) / (max - min) : 0

  function handleDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, value }
    moved.current = false
    const zone = (e.target as HTMLElement).closest('[data-nudge]')
    downDir.current = zone ? (Number(zone.getAttribute('data-nudge')) as 1 | -1) : null
  }

  function handleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 || !start.current) return
    const dx = e.clientX - start.current.x
    if (Math.abs(dx) > 3) moved.current = true
    const steps = Math.round(dx / pxPerStep)
    if (steps !== 0) onChange(snap(start.current.value + steps * step))
  }

  function handleUp() {
    if (!moved.current && downDir.current) onChange(snap(value + downDir.current * step))
    start.current = null
    downDir.current = null
    moved.current = false
  }

  const count = Math.max(1, Math.round((max - min) / step))
  const ticks = Array.from({ length: count + 1 }, (_, i) => {
    const v = min + i * step
    const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6
    return { v, isMajor, pos: (i / count) * 100 }
  }).filter((t) => t.isMajor || minorUntil == null || t.v <= minorUntil + 1e-6)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-sm text-ink-faint">{label}</span>

      <div
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
        className="flex flex-col gap-2 cursor-ew-resize touch-none select-none"
      >
        {/* Scrubber readout with nudging chevrons */}
        <div className="flex items-center justify-center gap-3">
          <span
            data-nudge={-1}
            role="button"
            aria-label={`Decrease ${label}`}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors duration-100 hover:text-ink"
          >
            <ChevronLeft className="h-5 w-5" />
          </span>

          <span className="text-[1.75rem] font-semibold tabular-nums text-ink">
            {value.toFixed(precision)}
          </span>

          <span
            data-nudge={1}
            role="button"
            aria-label={`Increase ${label}`}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-faint transition-colors duration-100 hover:text-ink"
          >
            <ChevronRight className="h-5 w-5" />
          </span>
        </div>

        {/* Ruler — visual indicator to show the current value */}
        <div
          aria-hidden
          className="relative h-12 w-full pointer-events-none select-none"
        >
          {ticks.map((t, i) => (
            <span
              key={i}
              className={cn(
                'absolute bottom-4 -translate-x-1/2',
                t.isMajor ? 'h-[22px] w-0.5 bg-ink' : 'h-[11px] w-px bg-ink-dim',
              )}
              style={{ left: `${t.pos}%` }}
            />
          ))}
          {ticks
            .filter((t) => t.isMajor)
            .map((t) => (
              <span
                key={`label-${t.v}`}
                className="absolute bottom-0 -translate-x-1/2 text-[0.7rem] tabular-nums text-ink-dim"
                style={{ left: `${t.pos}%` }}
              >
                {t.v.toFixed(0)}
              </span>
            ))}

          {/* Value marker */}
          <span
            className="absolute top-0 bottom-[13px] w-1 -translate-x-1/2 rounded-full bg-ember"
            style={{ left: `${frac * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}

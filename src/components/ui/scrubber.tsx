import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Scrubber — drag the number left/right to change it, the way a pro camera or
   DAW field works. No track and no end stops, so it never implies a ceiling on
   an open-ended value like yield or brew time. Movement is relative — every
   `pxPerStep` pixels is one step — so it's precise regardless of the number's
   size, and it snaps to the step so you always land on a real value.

   The chevrons flanking the number name the gesture: drag left to go down,
   right to go up. The label sits at the top; `fill` centres the number in
   whatever height it's given, for a card that holds a single value.
--------------------------------------------------------------------------- */

type ScrubberProps = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  /** Soft floor / ceiling. Default to open-ended so nothing implies a limit. */
  min?: number
  max?: number
  /** Renders the value — e.g. m:ss for time. Defaults to the plain number. */
  format?: (value: number) => ReactNode
  /** Unit shown after the readout (skipped when it's baked into `format`). */
  unit?: string
  /** Pixels of drag per step. Lower is faster/coarser. */
  pxPerStep?: number
  /** Fill the available height, centring the number under a pinned label. */
  fill?: boolean
  className?: string
}

export function Scrubber({
  label,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  format,
  unit,
  pxPerStep = 10,
  fill,
  className,
}: ScrubberProps) {
  // Where the drag began, so movement is measured from a fixed anchor rather
  // than accumulated (which would drift as the parent re-renders).
  const start = useRef<{ x: number; value: number } | null>(null)

  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const snap = (v: number) => {
    const stepped = Math.round(v / step) * step
    return clamp(Math.round(stepped * 1000) / 1000)
  }

  function handleDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, value }
  }

  function handleMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.buttons === 0 || !start.current) return
    const steps = Math.round((e.clientX - start.current.x) / pxPerStep)
    onChange(snap(start.current.value + steps * step))
  }

  function handleUp() {
    start.current = null
  }

  const readout = (
    <div
      role="slider"
      aria-label={label}
      aria-valuenow={value}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
      className="flex cursor-ew-resize touch-none select-none items-center justify-center gap-2"
    >
      <ChevronLeft aria-hidden className="h-5 w-5 shrink-0 text-ink-faint" />
      <span className="flex items-baseline gap-1 tabular-nums">
        <span className="text-4xl font-semibold text-ink">
          {format ? format(value) : value}
        </span>
        {unit ? <span className="text-xl text-ink-dim">{unit}</span> : null}
      </span>
      <ChevronRight aria-hidden className="h-5 w-5 shrink-0 text-ink-faint" />
    </div>
  )

  return (
    <div className={cn('flex flex-col gap-2', fill && 'h-full', className)}>
      <span className="text-sm text-ink-faint">{label}</span>
      {fill ? (
        <div className="flex flex-1 items-center justify-center">{readout}</div>
      ) : (
        readout
      )}
    </div>
  )
}

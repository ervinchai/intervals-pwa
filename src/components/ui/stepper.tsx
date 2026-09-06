import { Minus, Plus } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Stepper — a big −/＋ pair around a live readout, for dose, yield, temp, time.

   Sized for a finger at desk distance. Press and hold either side to repeat:
   a short delay, then a steady tick, so nudging 94 → 88 doesn't mean six taps.
--------------------------------------------------------------------------- */

type StepperProps = {
  label: string
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  /** Renders the value — defaults to the number plus an optional unit. */
  format?: (value: number) => ReactNode
  unit?: string
  /** Extra control dropped between the readout and nothing — e.g. a timer. */
  trailing?: ReactNode
  className?: string
}

export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  format,
  unit,
  trailing,
  className,
}: StepperProps) {
  // Mirror the latest value so hold-to-repeat reads it without waiting for the
  // parent's re-render between ticks.
  const live = useRef(value)
  useEffect(() => {
    live.current = value
  }, [value])

  const delayRef = useRef<number | undefined>(undefined)
  const repeatRef = useRef<number | undefined>(undefined)

  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 1000) / 1000))

  function bump(dir: 1 | -1) {
    const next = clamp(live.current + dir * step)
    live.current = next
    onChange(next)
  }

  function startHold(dir: 1 | -1) {
    bump(dir)
    delayRef.current = window.setTimeout(() => {
      repeatRef.current = window.setInterval(() => bump(dir), 90)
    }, 380)
  }

  function endHold() {
    window.clearTimeout(delayRef.current)
    window.clearInterval(repeatRef.current)
  }

  useEffect(() => endHold, [])

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-sm text-ink-faint">{label}</span>
      <div className="flex items-center gap-3">
        <StepButton
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onPointerDown={() => startHold(-1)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Minus className="h-6 w-6" />
        </StepButton>

        <div className="flex min-w-0 flex-1 items-baseline justify-center gap-1 tabular-nums">
          <span className="text-3xl font-semibold text-ink">
            {format ? format(value) : value}
          </span>
          {unit && !format ? <span className="text-lg text-ink-dim">{unit}</span> : null}
        </div>

        <StepButton
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onPointerDown={() => startHold(1)}
          onPointerUp={endHold}
          onPointerLeave={endHold}
          onPointerCancel={endHold}
        >
          <Plus className="h-6 w-6" />
        </StepButton>
      </div>
      {trailing}
    </div>
  )
}

function StepButton({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'button'>) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-12 w-12 shrink-0 touch-none select-none items-center justify-center rounded-control',
        'border border-line bg-surface text-ink',
        'transition-colors duration-100 active:bg-raised',
        'disabled:pointer-events-none disabled:opacity-30',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
        className,
      )}
      {...props}
    />
  )
}

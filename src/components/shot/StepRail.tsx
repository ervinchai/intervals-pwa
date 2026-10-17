import { Check } from 'lucide-react'

import { cn } from '@/lib/cn'

export type RailStep = {
  label: string
  /** What was settled in this step, shown once it is done: "2.9", "19.0 g". */
  summary?: string
}

/**
 * The steps of making a shot as one row: what is done, with what was settled in it, what is now, and
 * what is still to come. It is both the map of the flow and a running summary of the shot, so a glance
 * at it says what went into the cup. Done steps can be tapped to go back to; the current one is a
 * tint of the accent, and the ones to come are quiet. No transform, just colour, as everywhere in
 * the system.
 */
export function StepRail({
  steps,
  current,
  onJump,
}: {
  steps: RailStep[]
  /** The index of the step being done now. Earlier ones are done, later ones still to come. */
  current: number
  /** Called with the index of a done step that was tapped. Without it the rail is read-only. */
  onJump?: (index: number) => void
}) {
  return (
    <ol className="grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} aria-label="Steps">
      {steps.map((step, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'todo'
        const box = cn(
          'flex min-h-[3.25rem] w-full items-center gap-3 rounded-card border px-4 py-2 text-left',
          state === 'current' ? 'border-ember/45 bg-ember/12' : 'border-line',
          state === 'done' && 'bg-surface',
        )
        const body = (
          <>
            <span
              className={cn(
                'grid h-6 w-6 shrink-0 place-items-center rounded-full text-[0.75rem] font-semibold',
                state === 'done' && 'bg-sage/15 text-sage',
                state === 'todo' && 'bg-raised text-ink-faint',
              )}
              style={state === 'current' ? { background: 'var(--color-ember)', color: 'var(--color-ember-text)' } : undefined}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className={cn('text-[0.9375rem] font-semibold leading-tight', state === 'todo' ? 'text-ink-faint' : 'text-ink')}>
                {step.label}
              </span>
              <span className="min-h-4 text-xs leading-tight tabular-nums text-ink-dim">{state === 'todo' ? '' : (step.summary ?? '')}</span>
            </span>
          </>
        )
        return (
          <li key={step.label}>
            {state === 'done' && onJump ? (
              <button
                type="button"
                onClick={() => onJump(index)}
                aria-label={`${step.label}${step.summary ? `, ${step.summary}` : ''}. Go back to this step`}
                className={cn(box, 'transition-colors duration-150 ease-out active:bg-raised')}
              >
                {body}
              </button>
            ) : (
              <div className={box} aria-current={state === 'current' ? 'step' : undefined}>
                {body}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

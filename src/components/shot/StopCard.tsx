import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/** How the card is coloured: neutral, or one of the three accents as a low-opacity tint. */
export type CueTone = 'ink' | 'ember' | 'sage' | 'clay'

export type Cue = {
  tone: CueTone
  /** A solid block of the tone, for the one moment that has to be seen at a glance: stop. */
  solid?: boolean
  headline: string
  detail: string
  hint?: string
}

/** Literal class names, so Tailwind finds them. Tints follow the system: a 12% fill on a 45% border. */
const TINT: Record<CueTone, { box: string; headline: string }> = {
  ink: { box: 'bg-surface border-line', headline: 'text-ink' },
  ember: { box: 'bg-ember/12 border-ember/45', headline: 'text-ember' },
  sage: { box: 'bg-sage/12 border-sage/45', headline: 'text-sage' },
  clay: { box: 'bg-clay/12 border-clay/45', headline: 'text-clay' },
}

/**
 * What to do right now, in one card. The headline is in the display serif at a size that can be
 * read from across the counter, with the numbers behind it in one quiet line. Only the headline is
 * announced to a screen reader: the line under it changes eight times a second.
 * `children` go under a thin rule at the foot of the card: what else there is to say about the shot.
 */
export function StopCard({ cue, children }: { cue: Cue; children?: ReactNode }) {
  const tint = TINT[cue.tone]
  return (
    <div
      className={cn(
        'flex min-h-[8.5rem] flex-col justify-center rounded-card border px-7 py-4 transition-colors duration-150 ease-out',
        cue.solid ? 'border-sage bg-sage' : tint.box,
      )}
      style={cue.solid ? { color: 'var(--color-base)' } : undefined}
    >
      <div
        role="status"
        aria-live="assertive"
        className={cn('font-display text-[3.5rem] leading-none tracking-[-0.02em]', !cue.solid && tint.headline)}
      >
        {cue.headline}
      </div>
      {cue.detail ? <div className={cn('mt-2.5 text-[1.125rem] leading-snug tabular-nums', !cue.solid && 'text-ink')}>{cue.detail}</div> : null}
      <div className={cn('mt-0.5 min-h-5 text-[0.875rem]', !cue.solid && 'text-ink-dim')}>{cue.hint ?? ''}</div>
      {children ? <div className="mt-3 border-t border-line pt-3">{children}</div> : null}
    </div>
  )
}

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
 */
export function StopCard({ cue }: { cue: Cue }) {
  const tint = TINT[cue.tone]
  return (
    <div
      className={cn(
        'flex min-h-[12rem] flex-col justify-center rounded-card border px-8 py-6 transition-colors duration-150 ease-out',
        cue.solid ? 'border-sage bg-sage' : tint.box,
      )}
      style={cue.solid ? { color: 'var(--color-base)' } : undefined}
    >
      <div
        role="status"
        aria-live="assertive"
        className={cn('font-display text-[4.5rem] leading-none tracking-[-0.02em]', !cue.solid && tint.headline)}
      >
        {cue.headline}
      </div>
      <div className={cn('mt-4 text-[1.25rem] leading-snug tabular-nums', !cue.solid && 'text-ink')}>{cue.detail}</div>
      <div className={cn('mt-1 min-h-6 text-[0.9375rem]', !cue.solid && 'text-ink-dim')}>{cue.hint ?? ''}</div>
    </div>
  )
}

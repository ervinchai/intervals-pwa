import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Content primitives.
--------------------------------------------------------------------------- */

/**
 * Heading roles, not raw sizes.
 *
 * The face is baked into each role rather than chosen at the call site, which
 * enforces the one rule that matters for this pairing: Instrument Serif only
 * appears at 32px and above. It ships a single 400 weight, and below roughly
 * that size its high-contrast strokes go thin and lose all authority.
 *
 * Section headings therefore earn their rank through weight rather than size —
 * semibold sans at 24px against 20px regular body.
 */
const HEADING_ROLE = {
  /** Screen title. One per screen. */
  hero: 'font-display font-normal text-[2.5rem] leading-[1.05] tracking-[-0.02em]',
  /** Subject of the screen — a recipe name, a large readout. */
  display: 'font-display font-normal text-[2rem] leading-[1.1] tracking-[-0.015em]',
  /** Below a hero, above sections. */
  title: 'font-display font-normal text-[1.5rem] leading-[1.15] tracking-[-0.01em]',
  /** Card and section headings. Sans, and outranks body by weight. */
  section: 'font-sans font-semibold text-xl leading-snug tracking-[-0.01em]',
  /** Micro label above content — meal slots, group names, weekdays. */
  label: 'font-sans font-semibold text-xs uppercase leading-none tracking-[0.12em]',
} as const

const HEADING_TONE = {
  default: 'text-ink',
  dim: 'text-ink-dim',
  faint: 'text-ink-faint',
  ember: 'text-ember',
  sage: 'text-sage',
} as const

type HeadingProps = ComponentPropsWithoutRef<'h2'> & {
  role?: keyof typeof HEADING_ROLE
  tone?: keyof typeof HEADING_TONE
  level?: 1 | 2 | 3 | 4
  /** Escape hatch for display type that is not semantically a heading — a
   *  temperature readout, a weekday label. Overrides `level`. */
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'span' | 'div' | 'p'
}

export function Heading({
  className,
  role = 'title',
  tone = 'default',
  level = 2,
  as,
  ...props
}: HeadingProps) {
  const Tag = as ?? (`h${level}` as const)
  return (
    <Tag
      className={cn(
        'text-balance',
        HEADING_ROLE[role],
        HEADING_TONE[tone],
        className,
      )}
      {...props}
    />
  )
}

const TEXT_SIZE = {
  lg: 'text-lg',
  md: 'text-base',
  sm: 'text-sm',
  xs: 'text-xs',
} as const

const TEXT_TONE = {
  default: 'text-ink',
  dim: 'text-ink-dim',
  faint: 'text-ink-faint',
  ember: 'text-ember',
  sage: 'text-sage',
} as const

type TextProps = ComponentPropsWithoutRef<'p'> & {
  size?: keyof typeof TEXT_SIZE
  tone?: keyof typeof TEXT_TONE
  /** Renders inline instead of as a block. */
  inline?: boolean
}

/**
 * Body copy. Tuned for a docked iPad read at desk distance — comfortably large
 * without the arm's-length inflation that wasted the dashboard's screen.
 */
export function Text({
  className,
  size = 'md',
  tone = 'default',
  inline,
  ...props
}: TextProps) {
  const Tag = inline ? 'span' : 'p'
  return (
    <Tag
      className={cn('leading-relaxed', TEXT_SIZE[size], TEXT_TONE[tone], className)}
      {...props}
    />
  )
}

type ImageProps = ComponentPropsWithoutRef<'img'> & {
  /** Aspect ratio applied to the wrapper. */
  ratio?: 'square' | 'video' | 'wide' | 'hero'
  rounded?: boolean
}

const RATIO = {
  square: 'aspect-square',
  video: 'aspect-video',
  wide: 'aspect-[3/2]',
  hero: 'aspect-[21/9]',
} as const

/** Cover-fit image on a placeholder surface, so a slow load is not a white flash. */
export function Image({
  className,
  ratio = 'wide',
  rounded = true,
  alt = '',
  ...props
}: ImageProps) {
  return (
    <div
      className={cn(
        'w-full overflow-hidden bg-raised',
        RATIO[ratio],
        rounded && 'rounded-card',
        className,
      )}
    >
      <img
        className="h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        alt={alt}
        {...props}
      />
    </div>
  )
}

const BADGE_TONE = {
  neutral: 'bg-raised text-ink-dim border-line',
  ember: 'bg-ember/15 text-ember border-ember/30',
  sage: 'bg-sage/15 text-sage border-sage/30',
  clay: 'bg-clay/15 text-clay border-clay/30',
} as const

type BadgeProps = ComponentPropsWithoutRef<'span'> & {
  tone?: keyof typeof BADGE_TONE
}

/** Small metadata pill — time, servings, cuisine, status. */
export function Badge({ className, tone = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-3 py-1 text-sm whitespace-nowrap',
        BADGE_TONE[tone],
        className,
      )}
      {...props}
    />
  )
}

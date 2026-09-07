import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

/**
 * Every size sits at or above the 48px touch floor from the spec — this is
 * operated with wet hands, at a distance, sometimes at a glance.
 */
const button = cva(
  // No scale on press — the button holds its size and darkens instead, which
  // reads as a solid physical control rather than something that flinches away
  // from the finger. Feedback is a per-variant press colour, applied fast.
  'inline-flex items-center justify-center gap-2.5 rounded-control font-sans font-medium ' +
    'select-none transition-[background-color,color,border-color,opacity] duration-150 ease-out ' +
    'disabled:pointer-events-none disabled:opacity-40 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
  {
    variants: {
      variant: {
        primary: 'bg-ember text-ember-text hover:bg-ember-soft active:bg-ember-deep',
        secondary: 'bg-raised text-ink border border-line hover:bg-line active:bg-line',
        ghost: 'bg-transparent text-ink-dim hover:text-ink active:bg-raised',
        danger: 'bg-clay text-clay-text hover:opacity-90 active:brightness-90',
        /** Chosen option in a segmented picker — a quiet ember tint, not a
         *  solid fill, so a row of them doesn't shout. */
        select: 'bg-ember/12 text-ember border border-ember/45 active:bg-ember/20',
        /** Unchosen option — recedes until touched. */
        quiet:
          'bg-surface text-ink-dim border border-line hover:text-ink hover:border-ink-faint active:bg-raised',
      },
      size: {
        /** Form controls and segmented pickers — near the touch floor without
         *  the arm's-length inflation of `md`. */
        sm: 'min-h-9  px-3 text-[0.8125rem]',
        md: 'min-h-touch px-[18px] text-[0.9375rem]',
        lg: 'min-h-12 px-6 text-base',
        xl: 'min-h-14 px-8 text-[1.25rem]',
        /** Square icon-only button, still 48px. */
        icon: 'min-h-touch min-w-touch p-0',
      },
      full: {
        true: 'w-full',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ComponentPropsWithoutRef<'button'> &
  VariantProps<typeof button> & {
    /** Render the child element instead of a <button> (Radix Slot). */
    asChild?: boolean
  }

export function Button({
  className,
  variant,
  size,
  full,
  asChild,
  type = 'button',
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(button({ variant, size, full }), className)}
      {...(asChild ? {} : { type })}
      {...props}
    />
  )
}

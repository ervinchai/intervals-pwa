import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

/**
 * A single placeholder block. Compose these into a screen-shaped skeleton so the
 * jump from loading to loaded is invisible — same boxes, same positions, only
 * the shimmer swapped for content.
 *
 * Purely decorative: the surrounding region owns the `role="status"` /
 * `aria-busy` announcement, so each block is hidden from assistive tech.
 */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div aria-hidden className={cn('skeleton rounded-lg', className)} {...props} />
  )
}

/**
 * A placeholder sized to the *current line*, meant to be dropped inside a real
 * Heading/Text so it occupies that element's exact typographic box. Because it's
 * inline-block, the wrapping element still forms its normal line at its own
 * font-size and line-height — so the loading layout matches the loaded one to
 * the pixel and nothing shifts on arrival. Give the wrapper the width.
 */
export function SkeletonLine({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn('inline-block h-[0.7em] w-full rounded align-middle', className)}
    />
  )
}

/**
 * A run of text lines. The last line is shortened so a paragraph reads as prose
 * rather than a solid rectangle. `width` sets that final line.
 */
export function SkeletonText({
  lines = 3,
  width = '60%',
  className,
}: {
  lines?: number
  width?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton
          key={i}
          className="h-4"
          style={i === lines - 1 ? { width } : undefined}
        />
      ))}
    </div>
  )
}

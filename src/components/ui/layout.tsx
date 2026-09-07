import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Layout primitives. Generic by design — no domain component ever lives here.
--------------------------------------------------------------------------- */

const GAP = {
  none: '',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-3.5',
  xl: 'gap-5',
} as const

const PAD = {
  none: '',
  sm: 'p-2.5',
  md: 'p-3.5',
  lg: 'p-[18px]',
} as const

export type Gap = keyof typeof GAP
export type Pad = keyof typeof PAD

type PageProps = ComponentPropsWithoutRef<'div'> & {
  /** Renders on true black instead of the warm base — for idle/ambient screens. */
  void?: boolean
  pad?: Pad
}

/** Full-height scroll container for one screen. */
export function Page({ className, void: isVoid, pad = 'lg', ...props }: PageProps) {
  return (
    <div
      className={cn(
        'h-full w-full overflow-y-auto overflow-x-hidden',
        isVoid ? 'bg-void' : 'bg-base',
        PAD[pad],
        className,
      )}
      {...props}
    />
  )
}

const ALIGN = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
} as const

const JUSTIFY = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
} as const

type StackProps = ComponentPropsWithoutRef<'div'> & {
  gap?: Gap
  align?: keyof typeof ALIGN
  justify?: keyof typeof JUSTIFY
}

/** Vertical flow. */
export function Stack({
  className,
  gap = 'md',
  align = 'stretch',
  justify = 'start',
  ...props
}: StackProps) {
  return (
    <div
      className={cn('flex flex-col', GAP[gap], ALIGN[align], JUSTIFY[justify], className)}
      {...props}
    />
  )
}

/** Horizontal flow. */
export function Row({
  className,
  gap = 'md',
  align = 'center',
  justify = 'start',
  ...props
}: StackProps) {
  return (
    <div
      className={cn('flex flex-row', GAP[gap], ALIGN[align], JUSTIFY[justify], className)}
      {...props}
    />
  )
}

type GridProps = ComponentPropsWithoutRef<'div'> & {
  /** Column count at the iPad's landscape width. */
  cols?: 2 | 3 | 4 | 5 | 6 | 7
  gap?: Gap
}

const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
} as const

export function Grid({ className, cols = 4, gap = 'md', ...props }: GridProps) {
  return <div className={cn('grid', COLS[cols], GAP[gap], className)} {...props} />
}

/** Flexible blank space that pushes siblings apart. */
export function Spacer({ className }: { className?: string }) {
  return <div className={cn('flex-1', className)} aria-hidden />
}

type CardProps<T extends ElementType> = {
  as?: T
  children?: ReactNode
  pad?: Pad
  /** Adds press feedback — use when the card is tappable. */
  interactive?: boolean
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>

/** Raised surface. `as` lets it become a button when the whole card is tappable. */
export function Card<T extends ElementType = 'div'>({
  as,
  className,
  pad = 'md',
  interactive,
  ...props
}: CardProps<T>) {
  const Comp = (as ?? 'div') as ElementType
  return (
    <Comp
      className={cn(
        'rounded-card border border-line bg-surface',
        PAD[pad],
        interactive &&
          'text-left transition-[background-color] duration-150 ease-out active:bg-raised',
        className,
      )}
      {...props}
    />
  )
}

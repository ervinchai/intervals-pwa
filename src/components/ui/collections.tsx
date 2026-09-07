import * as Checkbox from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'

import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------------------
   Collection primitives: List, Checklist, Steps.
--------------------------------------------------------------------------- */

type ListProps = ComponentPropsWithoutRef<'ul'> & {
  /** Hairline separators between items. */
  divided?: boolean
}

export function List({ className, divided, ...props }: ListProps) {
  return (
    <ul
      className={cn('flex flex-col', divided && 'divide-y divide-line', className)}
      {...props}
    />
  )
}

type ListItemProps = ComponentPropsWithoutRef<'li'> & {
  /** Rendered before the content — an icon, index, or thumbnail. */
  lead?: ReactNode
  /** Rendered after the content, pushed to the far edge. */
  trail?: ReactNode
}

export function ListItem({ className, lead, trail, children, ...props }: ListItemProps) {
  return (
    <li
      className={cn('flex min-h-touch items-center gap-3 py-2 text-base text-ink', className)}
      {...props}
    >
      {lead ? <span className="shrink-0 text-ink-dim">{lead}</span> : null}
      <span className="min-w-0 flex-1">{children}</span>
      {trail ? <span className="shrink-0 text-ink-dim">{trail}</span> : null}
    </li>
  )
}

type ChecklistItemProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
  /** Secondary text shown to the right — quantity, note, aisle. */
  trail?: ReactNode
  disabled?: boolean
  className?: string
}

/**
 * A checkable row. The label is the hit target, so the whole line responds —
 * ingredient ticking happens mid-cook with one free hand.
 */
export function ChecklistItem({
  checked,
  onCheckedChange,
  children,
  trail,
  disabled,
  className,
}: ChecklistItemProps) {
  return (
    <label
      className={cn(
        'flex min-h-touch cursor-pointer items-center gap-3 rounded-card px-2 py-1.5',
        'transition-colors duration-150 active:bg-raised',
        disabled && 'pointer-events-none opacity-40',
        className,
      )}
    >
      <Checkbox.Root
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        disabled={disabled}
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-line',
          'transition-colors duration-150',
          'data-[state=checked]:border-sage data-[state=checked]:bg-sage',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
        )}
      >
        <Checkbox.Indicator>
          <Check className="h-4 w-4 text-base" strokeWidth={3} />
        </Checkbox.Indicator>
      </Checkbox.Root>

      <span
        className={cn(
          'min-w-0 flex-1 text-base transition-colors duration-150',
          checked ? 'text-ink-faint line-through' : 'text-ink',
        )}
      >
        {children}
      </span>

      {trail ? (
        <span className="shrink-0 text-sm text-ink-dim tabular-nums">{trail}</span>
      ) : null}
    </label>
  )
}

export function Checklist({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div className={cn('flex flex-col', className)} {...props} />
}

type StepsProps = ComponentPropsWithoutRef<'ol'>

/** Numbered instruction list. */
export function Steps({ className, ...props }: StepsProps) {
  return <ol className={cn('flex flex-col gap-[18px]', className)} {...props} />
}

type StepProps = ComponentPropsWithoutRef<'li'> & {
  index: number
  /** Dims the step and marks the marker done. */
  done?: boolean
  /** Highlights this as the step being worked on. */
  active?: boolean
}

export function Step({ className, index, done, active, children, ...props }: StepProps) {
  return (
    <li className={cn('flex gap-3.5', className)} {...props}>
      <span
        className={cn(
          'flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full',
          // Sans here, not the display serif: a 400-weight serif numeral inside a
          // small disc reads thin and loses its punch at a glance.
          'text-base font-medium tabular-nums transition-colors duration-200',
          active && 'bg-ember text-base',
          !active && done && 'bg-sage/20 text-sage',
          !active && !done && 'bg-raised text-ink-dim',
        )}
      >
        {index}
      </span>
      <div
        className={cn(
          'flex-1 pt-1 text-base leading-relaxed transition-colors duration-200',
          done ? 'text-ink-faint' : 'text-ink',
        )}
      >
        {children}
      </div>
    </li>
  )
}

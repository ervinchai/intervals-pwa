import type { ComponentPropsWithoutRef } from 'react'

import { cn } from '@/lib/cn'

type InputProps = ComponentPropsWithoutRef<'input'>

/**
 * Single-line text entry. Autocorrect and capitalisation are left on — this is
 * mostly used for shopping-list items typed one-handed.
 */
export function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        'min-h-touch w-full rounded-control border border-line bg-surface px-4',
        'text-ink placeholder:text-ink-faint',
        'transition-colors duration-150',
        'focus:border-ember focus:outline-none',
        'disabled:opacity-40',
        className,
      )}
      {...props}
    />
  )
}

import * as Switch from '@radix-ui/react-switch'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useId } from 'react'

import { cn } from '@/lib/cn'

type ToggleProps = ComponentPropsWithoutRef<typeof Switch.Root> & {
  label?: ReactNode
}

/**
 * On/off control. The whole row is the hit area — a bare 32px switch thumb is
 * not a realistic target on a kitchen display.
 */
export function Toggle({ className, label, id, ...props }: ToggleProps) {
  const generatedId = useId()
  const switchId = id ?? generatedId

  const control = (
    <Switch.Root
      id={switchId}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full border border-line bg-raised',
        'transition-colors duration-200 data-[state=checked]:border-ember data-[state=checked]:bg-ember',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember',
        'disabled:opacity-40',
        !label && className,
      )}
      {...props}
    >
      <Switch.Thumb
        className={cn(
          'block h-5 w-5 translate-x-[3px] rounded-full bg-ink shadow-sm',
          'transition-transform duration-200 will-change-transform',
          'data-[state=checked]:translate-x-[25px] data-[state=checked]:bg-base',
        )}
      />
    </Switch.Root>
  )

  if (!label) return control

  return (
    <label
      htmlFor={switchId}
      className={cn(
        'flex min-h-touch cursor-pointer items-center justify-between gap-4',
        'rounded-card px-2 text-base text-ink active:bg-raised',
        className,
      )}
    >
      <span>{label}</span>
      {control}
    </label>
  )
}

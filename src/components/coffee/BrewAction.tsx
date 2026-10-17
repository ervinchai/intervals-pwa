import { ChevronDown, Coffee, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useRouter } from '@/app/router'
import { Button } from '@/components/ui'
import { brewKind } from '@/lib/coffee-utils'

/**
 * The one way into brewing a bean, which depends on how the bean is brewed (its roast profile):
 * - espresso: "Make espresso", the guided flow with the scale;
 * - filter: "Add brew log", the usual brew log, which opens on V60;
 * - omniroast (or both, or not said): a dropdown to pick one of the two.
 */
export function BrewAction({
  beanId,
  brewMethods,
  size = 'sm',
}: {
  beanId: string
  brewMethods: readonly string[] | undefined
  size?: 'sm' | 'md'
}) {
  const { navigate } = useRouter()
  const kind = brewKind(brewMethods)
  const makeEspresso = () => navigate({ name: 'espresso', beanId })
  const addBrewLog = () => navigate({ name: 'brew', beanId })

  if (kind === 'espresso') {
    return (
      <Button variant="primary" size={size} onClick={makeEspresso}>
        <Coffee className="mr-1 h-4 w-4" />
        Make espresso
      </Button>
    )
  }
  if (kind === 'filter') {
    return (
      <Button variant="primary" size={size} onClick={addBrewLog}>
        <Plus className="mr-1 h-4 w-4" />
        Add brew log
      </Button>
    )
  }
  return <BrewMenu size={size} onMakeEspresso={makeEspresso} onAddBrewLog={addBrewLog} />
}

/**
 * A button that opens a small menu of two choices. The system has no select (enums are rows of
 * buttons), but a menu is the right shape for "which way do I brew this one", which is asked once and
 * should not take up a row. It sits on the raised surface with a hairline, no shadow, as the system
 * does elevation. A tap outside it, or Escape, closes it.
 */
function BrewMenu({ size, onMakeEspresso, onAddBrewLog }: { size: 'sm' | 'md'; onMakeEspresso: () => void; onAddBrewLog: () => void }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <Button variant="primary" size={size} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Coffee className="mr-1 h-4 w-4" />
        Brew
        <ChevronDown className="ml-1 h-4 w-4" />
      </Button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-20 mt-2 flex w-64 flex-col gap-0.5 rounded-card border border-line bg-raised p-1">
          <MenuItem
            icon={<Coffee className="h-4 w-4 text-ember" />}
            title="Make espresso"
            note="Guided: grind, dose, pull, rate"
            onSelect={() => {
              setOpen(false)
              onMakeEspresso()
            }}
          />
          <MenuItem
            icon={<Plus className="h-4 w-4 text-ember" />}
            title="Add brew log"
            note="Filter and other methods"
            onSelect={() => {
              setOpen(false)
              onAddBrewLog()
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function MenuItem({ icon, title, note, onSelect }: { icon: React.ReactNode; title: string; note: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onSelect}
      className="flex min-h-11 items-center gap-3 rounded-control px-3 py-2 text-left transition-colors duration-150 ease-out active:bg-line"
    >
      {icon}
      <span className="flex flex-col">
        <span className="text-[0.9375rem] font-semibold leading-tight text-ink">{title}</span>
        <span className="text-xs leading-tight text-ink-dim">{note}</span>
      </span>
    </button>
  )
}

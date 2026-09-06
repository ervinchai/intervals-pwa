import { useCallback, useMemo, useState, type ReactNode } from 'react'

import { RouterContext, type Screen } from '@/app/router'

/** Structural equality — used to avoid stacking a screen on top of itself. */
function sameScreen(a: Screen, b: Screen): boolean {
  if (a.name !== b.name) return false
  if (a.name === 'recipe' && b.name === 'recipe') return a.recipeId === b.recipeId
  return true
}

export function RouterProvider({
  initial = { name: 'today' },
  children,
}: {
  initial?: Screen
  children: ReactNode
}) {
  // The stack's top is the current screen; everything beneath it is history, so
  // `back` returns to whatever was viewed before — the meal plan, the
  // collection, or Today — not a fixed screen.
  const [stack, setStack] = useState<Screen[]>([initial])
  const [isRemote, setIsRemote] = useState(false)

  const screen = stack[stack.length - 1]

  const navigate = useCallback((next: Screen) => {
    setIsRemote(false)
    setStack((prev) => {
      const current = prev[prev.length - 1]
      // A repeated tap on the current screen should not grow the history.
      return sameScreen(current, next) ? prev : [...prev, next]
    })
  }, [])

  // Phase 5 hands this to the HA subscription so a pushed screen can be
  // distinguished from a tapped one (different transition, no back affordance).
  // A remote push replaces the top rather than stacking, so HA polling the same
  // screen can never build up unbounded history.
  const navigateRemote = useCallback((next: Screen) => {
    setIsRemote(true)
    setStack((prev) => [...prev.slice(0, -1), next])
  }, [])

  const back = useCallback(() => {
    setIsRemote(false)
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const value = useMemo(
    () => ({
      screen,
      navigate,
      navigateRemote,
      back,
      canGoBack: stack.length > 1,
      isRemote,
    }),
    [screen, navigate, navigateRemote, back, stack.length, isRemote],
  )

  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
}

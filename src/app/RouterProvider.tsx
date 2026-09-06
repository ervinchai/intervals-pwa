import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  RouterContext,
  screenFromPath,
  screenToPath,
  type Screen,
} from '@/app/router'

/** Structural equality — used to avoid stacking a screen on top of itself. */
function sameScreen(a: Screen, b: Screen): boolean {
  if (a.name !== b.name) return false
  if (a.name === 'recipe' && b.name === 'recipe') return a.recipeId === b.recipeId
  if (a.name === 'bean' && b.name === 'bean') return a.beanId === b.beanId
  if (a.name === 'brew' && b.name === 'brew') return a.beanId === b.beanId
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
  // The first URL sync replaces (canonicalises the loaded URL) rather than
  // pushing, so it doesn't leave a phantom entry behind the landing screen.
  const didSyncUrl = useRef(false)

  const screen = stack[stack.length - 1]
  // The current screen's canonical path — a stable identity (param included) so
  // the URL-sync effect fires exactly when the screen actually changes.
  const screenPath = screenToPath(screen)

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

  // Keep the address bar in sync with the current screen, and honour the
  // browser's back/forward buttons. Without this the URL never reflects the
  // page: navigation is pure in-memory state and a reload loses the screen.
  useEffect(() => {
    const firstSync = !didSyncUrl.current
    didSyncUrl.current = true
    if (window.location.pathname === screenPath) return
    // The first sync canonicalises the loaded URL (replace) so it doesn't stack
    // a phantom entry behind the landing screen; later ones are real pushes.
    if (firstSync) {
      window.history.replaceState(null, '', screenPath)
    } else {
      window.history.pushState(null, '', screenPath)
    }
  }, [screenPath])

  useEffect(() => {
    const onPopState = () => {
      const next = screenFromPath(window.location.pathname) ?? {
        name: 'today' as const,
      }
      // Replace the top rather than stacking, so browser history stays the
      // authority on back/forward depth.
      setIsRemote(false)
      setStack((prev) =>
        sameScreen(prev[prev.length - 1], next)
          ? prev
          : [...prev.slice(0, -1), next],
      )
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
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

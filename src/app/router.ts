import { createContext, useContext } from 'react'

/**
 * Screen state.
 *
 * Two things drive this: user taps, and Home Assistant writing to
 * `input_text.active_screen` (phase 5). Both funnel through `navigate`, so the
 * HA subscription will be a thin adapter rather than a second routing path.
 *
 * Kept separate from RouterProvider so this module exports no components —
 * mixing the two breaks React Fast Refresh.
 */
export type Screen =
  | { name: 'today' }
  | { name: 'meal-plan' }
  | { name: 'collection' }
  | { name: 'recipe'; recipeId: string }
  | { name: 'settings' }
  | { name: 'scan' }

export type ScreenName = Screen['name']

export type RouterValue = {
  screen: Screen
  /** Navigate from a user tap. */
  navigate: (screen: Screen) => void
  /** Navigate on behalf of Home Assistant. */
  navigateRemote: (screen: Screen) => void
  /** Return to the previously viewed screen. No-op with no history. */
  back: () => void
  /** True when there is a previous screen to return to. */
  canGoBack: boolean
  /** True when the current screen was pushed by HA rather than tapped. */
  isRemote: boolean
}

export const RouterContext = createContext<RouterValue | null>(null)

export function useRouter(): RouterValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside <RouterProvider>')
  return ctx
}

/**
 * Parses the raw string HA puts in `input_text.active_screen`.
 * Accepts "today", "meal-plan", "recipe:ragu-bianco".
 *
 * Returns null for anything unrecognised — a typo in an HA automation should
 * leave the current screen alone, not blank the display.
 */
export function parseScreenString(raw: string): Screen | null {
  const value = raw.trim()
  if (!value) return null

  const separator = value.indexOf(':')
  const name = separator === -1 ? value : value.slice(0, separator)
  const param = separator === -1 ? '' : value.slice(separator + 1)

  switch (name) {
    case 'today':
      return { name: 'today' }
    case 'meal-plan':
      return { name: 'meal-plan' }
    case 'collection':
      return { name: 'collection' }
    case 'recipe':
      return param ? { name: 'recipe', recipeId: param } : null
    case 'settings':
      return { name: 'settings' }
    case 'scan':
      return { name: 'scan' }
    default:
      return null
  }
}

/**
 * Resolves the screen a deep link asks for, from a scanned QR code or shared
 * URL. The Camera app opens a URL like `https://intervals/?s=recipe:ragu-bianco`;
 * we read the `s` query param (falling back to `screen`) and reuse the same
 * grammar HA uses, so both entry points stay in lockstep.
 *
 * Returns null when there is no deep link or it is unrecognised, letting boot
 * fall back to the default screen rather than blanking the display.
 */
export function screenFromUrl(url: string | URL): Screen | null {
  try {
    const { searchParams } = new URL(url)
    const raw = searchParams.get('s') ?? searchParams.get('screen')
    return raw ? parseScreenString(raw) : null
  } catch {
    return null
  }
}

/**
 * Resolves a raw QR payload decoded by the in-app scanner. A code may carry
 * either a full deep-link URL (`https://intervals/?s=recipe:ragu-bianco`) or a
 * bare grammar string (`recipe:ragu-bianco`), so we try the URL form first and
 * fall back to parsing the payload directly.
 */
export function screenFromScan(payload: string): Screen | null {
  return screenFromUrl(payload) ?? parseScreenString(payload)
}

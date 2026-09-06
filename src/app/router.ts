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
  | { name: 'beans' }
  | { name: 'bean'; beanId: string }
  | { name: 'settings' }
  | { name: 'scan' }
  | { name: 'print' }

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
 * The one place a screen name + optional param becomes a `Screen`. Every entry
 * point — HA's `input_text.active_screen`, web deep links, scanned QR codes —
 * funnels through here, so the vocabulary of routable screens is defined once.
 *
 * Returns null for anything unrecognised — a typo in an automation or a stray
 * QR code should leave the current screen alone, not blank the display.
 */
function screenFromParts(name: string, param: string): Screen | null {
  switch (name) {
    case 'today':
      return { name: 'today' }
    case 'meal-plan':
      return { name: 'meal-plan' }
    case 'collection':
      return { name: 'collection' }
    case 'recipe':
      return param ? { name: 'recipe', recipeId: param } : null
    case 'beans':
      return { name: 'beans' }
    case 'bean':
      return param ? { name: 'bean', beanId: param } : null
    case 'settings':
      return { name: 'settings' }
    case 'scan':
      return { name: 'scan' }
    case 'print':
      return { name: 'print' }
    default:
      return null
  }
}

/**
 * Parses the raw string HA puts in `input_text.active_screen`.
 * Accepts "today", "meal-plan", "recipe:ragu-bianco".
 */
export function parseScreenString(raw: string): Screen | null {
  const value = raw.trim()
  if (!value) return null

  const separator = value.indexOf(':')
  const name = separator === -1 ? value : value.slice(0, separator)
  const param = separator === -1 ? '' : value.slice(separator + 1)
  return screenFromParts(name, param)
}

/**
 * Parses the canonical Intervals QR/deep-link format: `intervals://<screen>` or
 * `intervals://<screen>/<param>`, e.g. `intervals://recipe/ragu-bianco`.
 *
 * The scheme host is the screen name and the first path segment is the param,
 * so the same routable vocabulary as everywhere else applies. Returns null for
 * any other scheme or an unrecognised screen.
 *
 * Parsing is deliberately local: scan → route must be instant and work offline
 * on the docked iPad. If a scheme ever needs a *dynamic*, backend-resolved
 * target (e.g. `intervals://recipe/current` meaning "whatever's cooking now"),
 * route just that scheme through Windmill here rather than moving all parsing
 * server-side — the static schemes should stay local.
 */
export function parseIntervalsUri(raw: string): Screen | null {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'intervals:') return null

  const name = url.hostname
  // Take the first path segment as the param; decodeURIComponent restores any
  // characters the URL parser percent-escaped (e.g. accents in a slug).
  const rawParam = url.pathname.replace(/^\/+/, '').split('/')[0] ?? ''
  let param = rawParam
  try {
    param = decodeURIComponent(rawParam)
  } catch {
    // Malformed escape — fall back to the raw segment rather than throwing.
  }
  return screenFromParts(name, param)
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
 * Resolves a raw QR payload decoded by the in-app scanner. The canonical format
 * is the `intervals://<screen>/<param>` URI; we fall back to the older `?s=`
 * web deep link and the bare `recipe:ragu-bianco` grammar so existing codes and
 * shared links keep working.
 */
export function screenFromScan(payload: string): Screen | null {
  return (
    parseIntervalsUri(payload) ??
    screenFromUrl(payload) ??
    parseScreenString(payload)
  )
}

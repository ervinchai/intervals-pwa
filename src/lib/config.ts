import { z } from 'zod'

/**
 * Runtime configuration.
 *
 * Deliberately fetched at boot rather than compiled in via `import.meta.env`:
 * the HA long-lived token and the Windmill token must never end up in a
 * bundle that ships to Cloudflare Pages. `public/config.json` is gitignored and
 * written per-deployment; `config.example.json` documents the shape.
 */
export const ConfigSchema = z.object({
  /** Base URL of the Windmill instance, no trailing slash, e.g. https://windmill.example.com */
  windmillBaseUrl: z.string().url().or(z.literal('')),
  /** Windmill workspace id the backend scripts live in. */
  windmillWorkspace: z.string().default(''),
  /** Windmill token sent as a Bearer header on every call. Never bundled — read from config.json at boot. */
  windmillToken: z.string().default(''),
  /** Home Assistant base URL, e.g. https://ha.example.com */
  haBaseUrl: z.string().url().or(z.literal('')),
  /** HA long-lived access token for the WebSocket client. */
  haToken: z.string().default(''),
  /** Entity the hub watches to be told which screen to show. */
  activeScreenEntity: z.string().default('input_text.active_screen'),
  /** VAPID public key for push subscription. */
  vapidPublicKey: z.string().default(''),
  /** Minutes of no touch before dropping to the idle/ambient screen. */
  idleTimeoutMinutes: z.number().positive().default(5),
  /** When true, screens read from src/mock instead of calling Windmill. */
  useMockData: z.boolean().default(true),
  /**
   * Per-endpoint overrides of `useMockData`, so one live endpoint can ship
   * ahead of the others. A key set to `false` forces that endpoint live even
   * when `useMockData` is true (and `true` pins it to mock). Endpoints are
   * grouped by resource: `recipes` covers both the collection and detail.
   */
  mockOverrides: z
    .object({
      today: z.boolean().optional(),
      recipes: z.boolean().optional(),
      mealPlan: z.boolean().optional(),
      coffee: z.boolean().optional(),
    })
    .default({}),
})

/** Resource keys that can be independently flipped live via `mockOverrides`. */
export type MockEndpoint = keyof NonNullable<Config['mockOverrides']>

export type Config = z.infer<typeof ConfigSchema>

/** Used when config.json is absent — keeps `npm run dev` working out of the box. */
const FALLBACK: Config = {
  windmillBaseUrl: '',
  windmillWorkspace: '',
  windmillToken: '',
  haBaseUrl: '',
  haToken: '',
  activeScreenEntity: 'input_text.active_screen',
  vapidPublicKey: '',
  idleTimeoutMinutes: 5,
  useMockData: true,
  mockOverrides: {},
}

let cached: Config | null = null

export async function loadConfig(): Promise<Config> {
  if (cached) return cached

  try {
    // cache: 'no-store' — the service worker must never hand back a stale token.
    const res = await fetch('/config.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`config.json returned ${res.status}`)

    const parsed = ConfigSchema.safeParse(await res.json())
    if (!parsed.success) {
      console.warn('[intervals] config.json is malformed, falling back to mock mode', parsed.error.issues)
      cached = FALLBACK
      return cached
    }
    cached = parsed.data
  } catch (err) {
    console.warn('[intervals] no usable config.json, running on mock data', err)
    cached = FALLBACK
  }

  return cached
}

/** Config already resolved by the boot sequence. Throws if read too early. */
export function getConfig(): Config {
  if (!cached) throw new Error('loadConfig() must resolve before getConfig()')
  return cached
}

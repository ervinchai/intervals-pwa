// Write public/config.json from environment variables at build time.
//
// public/config.json is gitignored (it can hold the HA token and Windmill token), so
// a Git-driven build — e.g. Cloudflare Pages — has no config and the app would
// fall back to mock mode. This regenerates it from the deploy environment.
//
// Run via `npm run build:pages` (gen-config → tsc → vite). Vite copies
// public/config.json into dist/, served at /config.json (fetched no-store, and
// not precached — globPatterns excludes .json — so tokens never go stale).
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const bool = (v, fallback) => (v == null ? fallback : v === 'true')
const num = (v, fallback) => (v == null || v === '' ? fallback : Number(v))

function parseOverrides(raw) {
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error(`MOCK_OVERRIDES is not valid JSON: ${raw}`)
  }
}

const config = {
  windmillBaseUrl: process.env.WINDMILL_BASE_URL ?? '',
  windmillWorkspace: process.env.WINDMILL_WORKSPACE ?? '',
  windmillToken: process.env.WINDMILL_TOKEN ?? '',
  haBaseUrl: process.env.HA_BASE_URL ?? '',
  haToken: process.env.HA_TOKEN ?? '',
  activeScreenEntity: process.env.ACTIVE_SCREEN_ENTITY ?? 'input_text.active_screen',
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY ?? '',
  idleTimeoutMinutes: num(process.env.IDLE_TIMEOUT_MINUTES, 5),
  useMockData: bool(process.env.USE_MOCK_DATA, true),
  mockOverrides: parseOverrides(process.env.MOCK_OVERRIDES),
}

const out = fileURLToPath(new URL('../public/config.json', import.meta.url))
writeFileSync(out, JSON.stringify(config, null, 2) + '\n')

// Log without leaking secrets.
const redacted = { ...config, windmillToken: config.windmillToken ? '***' : '', haToken: config.haToken ? '***' : '' }
console.log('[gen-config] wrote public/config.json:', JSON.stringify(redacted))

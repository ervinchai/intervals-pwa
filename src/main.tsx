import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'

import { App } from '@/app/App'
import { screenFromUrl } from '@/app/router'
import { loadConfig } from '@/lib/config'
import '@/index.css'

/**
 * Boot sequence: resolve runtime config before the first render so screens can
 * read it synchronously, then mount. Config failure is non-fatal — the loader
 * falls back to mock mode so the hub still shows something on the wall.
 */
async function boot() {
  const config = await loadConfig()

  // A scanned QR code / shared link lands here as `?s=recipe:ragu-bianco`.
  // Resolve it before first render so we open straight onto the target screen.
  const initialScreen = screenFromUrl(window.location.href) ?? undefined

  const root = document.getElementById('root')
  if (!root) throw new Error('#root missing from index.html')

  createRoot(root).render(
    <StrictMode>
      <App config={config} initialScreen={initialScreen} />
    </StrictMode>,
  )
}

// Unattended display: take updates silently on the next navigation.
registerSW({ immediate: true })

void boot()

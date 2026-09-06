import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

/** Short commit the build was cut from, marked -dirty for an uncommitted tree,
 *  so the Settings screen can name the exact running build with no ambiguity. */
function gitRevision(): string {
  try {
    const hash = execSync('git rev-parse --short HEAD').toString().trim()
    const dirty = execSync('git status --porcelain').toString().trim().length > 0
    return dirty ? `${hash}-dirty` : hash
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  // Baked in at build time; surfaced on the Settings screen.
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_REV__: JSON.stringify(gitRevision()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // The hub is unattended on a docked iPad — nobody is there to accept an
      // update prompt, so refresh in the background instead.
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Intervals',
        short_name: 'Intervals',
        description: 'Kitchen and life hub',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#100e0c',
        theme_color: '#100e0c',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
        // config.json carries runtime secrets and must never be baked into the
        // precache manifest — it is fetched fresh on every boot.
        globIgnores: ['**/config.json'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Recipe/meal imagery: serve instantly from cache, refresh behind.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'intervals-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: {
        // Lets the service worker be exercised during `npm run dev`.
        enabled: true,
        type: 'module',
      },
    }),
  ],
})

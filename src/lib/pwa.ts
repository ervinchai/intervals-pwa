/**
 * Force the kiosk onto the freshest build.
 *
 * A plain `location.reload()` is not enough in a PWA: the service worker
 * intercepts the navigation and hands back the *cached* bundle, so the display
 * can sit on a stale build indefinitely. To guarantee the latest version we
 * tear the offline layer down first —
 *
 *   1. delete every Cache Storage entry (the Workbox precache + the runtime
 *      image cache), so nothing old can be served back;
 *   2. unregister the service worker(s), so the reload can't be intercepted and
 *      goes straight to the network;
 *   3. reload.
 *
 * On the next boot `registerSW()` re-registers and re-precaches from scratch, so
 * offline support returns immediately — this only sacrifices it for the one trip
 * through the network.
 */
export async function hardReload(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch (err) {
    // Never trap the user on a broken build: if teardown fails, reload anyway.
    console.error('[intervals] cache/SW teardown failed; reloading regardless', err)
  } finally {
    window.location.reload()
  }
}

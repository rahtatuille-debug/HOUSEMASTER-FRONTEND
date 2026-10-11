// Installs the service worker (built into dist/sw.js by vite.config.js), which
// shows phone and browser notifications. It keeps no copy of the app (online
// only) and removes the copies the old offline version left. Production only.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    removeOfflineCopies()
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not supported here (private mode, old browser): the app works as before.
    })
  })
}

// The copies of the app the old offline version kept on the phone (the worker removes them too).
export function removeOfflineCopies() {
  if (typeof caches === 'undefined') return Promise.resolve()
  return caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('housemaster-')).map((k) => caches.delete(k))))
    .catch(() => {})
}

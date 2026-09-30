// Installs the service worker (built into dist/sw.js by vite.config.js) so
// the app opens without a signal and can be added to the home screen. Only
// in production builds: in development it would serve stale files.
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Not supported here (private mode, old browser): the app works as before.
    })
  })
}

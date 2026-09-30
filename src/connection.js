// Whether the server can be reached right now, for the offline banner.
// The browser's own online/offline flag only knows about the phone's
// connection; api.js also reports each request that got an answer or never
// got through, which catches a weak signal the browser still calls online.
let state = { reachable: true }
const listeners = new Set()

function set(next) {
  if (next.reachable === state.reachable) return
  state = next
  for (const listener of listeners) listener(state)
}

export const connection = {
  get: () => state,
  report: (reachable) => set({ reachable }),
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  // Tests only.
  reset() {
    state = { reachable: true }
    listeners.clear()
  },
}

export function browserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

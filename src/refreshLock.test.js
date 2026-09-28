// F-3: token refresh stays single-flight, and never replays a rotated
// refresh token, in browsers without Web Locks (older Safari) and where
// navigator.locks exists but throws.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from './api.js'

const TOKEN_KEY = 'housemaster_tokens'
const LEASE_KEY = 'housemaster_refresh_lease'

function json(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } }))
}
const store = (tokens) => localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
const stored = () => JSON.parse(localStorage.getItem(TOKEN_KEY))

function routes(map) {
  return vi.fn((url, init = {}) => (map[new URL(url).pathname] || (() => json(404)))(url, init))
}

// Every endpoint accepts only the new access token.
function backend(refresh) {
  const ok = (body) => (url, init) => (init.headers.Authorization === 'Bearer new-access' ? json(200, body) : json(401))
  return routes({ '/api/me/': ok({ id: 1 }), '/api/dashboard/': ok({ ok: true }), '/api/token/refresh/': refresh })
}

function setLocks(value) {
  Object.defineProperty(navigator, 'locks', { value, configurable: true })
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})
afterEach(() => setLocks(undefined))

describe('without Web Locks', () => {
  beforeEach(() => setLocks(undefined))

  it('shares one refresh between requests that expire together', async () => {
    store({ access: 'old-access', refresh: 'r1' })
    const refresh = vi.fn(() => json(200, { access: 'new-access', refresh: 'r2' }))
    globalThis.fetch = backend(refresh)
    await Promise.all([api.me(), api.dashboard(), api.me(), api.dashboard()])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(stored()).toEqual({ access: 'new-access', refresh: 'r2' })
    expect(localStorage.getItem(LEASE_KEY)).toBeNull()
  })

  it('waits for another tab that is refreshing instead of replaying the old refresh token', async () => {
    store({ access: 'old-access', refresh: 'r1' })
    // Another tab has started a refresh and holds the lease.
    localStorage.setItem(LEASE_KEY, JSON.stringify({ id: 'other-tab', until: Date.now() + 5000 }))
    const refresh = vi.fn(() => json(401))
    globalThis.fetch = backend(refresh)
    const pending = api.me()
    // The other tab finishes: it stores rotated tokens and releases the lease.
    setTimeout(() => {
      const newValue = JSON.stringify({ access: 'new-access', refresh: 'r2' })
      localStorage.setItem(TOKEN_KEY, newValue)
      localStorage.removeItem(LEASE_KEY)
      window.dispatchEvent(new StorageEvent('storage', { key: TOKEN_KEY, newValue }))
    }, 50)
    await expect(pending).resolves.toEqual({ id: 1 })
    expect(refresh).not.toHaveBeenCalled()
    expect(stored()).toEqual({ access: 'new-access', refresh: 'r2' })
  })

  it('takes over after a lease left behind by a closed tab expires', async () => {
    store({ access: 'old-access', refresh: 'r1' })
    localStorage.setItem(LEASE_KEY, JSON.stringify({ id: 'crashed-tab', until: Date.now() - 1 }))
    const refresh = vi.fn(() => json(200, { access: 'new-access', refresh: 'r2' }))
    globalThis.fetch = backend(refresh)
    await expect(api.me()).resolves.toEqual({ id: 1 })
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(LEASE_KEY)).toBeNull()
  })

  it('signs out once, without a loop, when the refresh token is refused', async () => {
    store({ access: 'old-access', refresh: 'dead' })
    const refresh = vi.fn(() => json(401))
    globalThis.fetch = backend(refresh)
    const results = await Promise.allSettled([api.me(), api.dashboard()])
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    // Signed out: a later request doesn't try to refresh again.
    await api.me().catch(() => {})
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('logout clears the tokens and any refresh lease', () => {
    store({ access: 'a', refresh: 'r' })
    localStorage.setItem(LEASE_KEY, JSON.stringify({ id: 'x', until: Date.now() + 5000 }))
    globalThis.fetch = vi.fn(() => json(200))
    api.logout()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(localStorage.getItem(LEASE_KEY)).toBeNull()
  })
})

describe('when navigator.locks throws', () => {
  it('still refreshes exactly once when request() throws synchronously', async () => {
    setLocks({ request: () => { throw new DOMException('The request was denied.', 'SecurityError') } })
    store({ access: 'old-access', refresh: 'r1' })
    const refresh = vi.fn(() => json(200, { access: 'new-access', refresh: 'r2' }))
    globalThis.fetch = backend(refresh)
    await expect(Promise.all([api.me(), api.dashboard()])).resolves.toEqual([{ id: 1 }, { ok: true }])
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('still refreshes exactly once when request() rejects before running the callback', async () => {
    setLocks({ request: () => Promise.reject(new DOMException('Locks are not available.', 'InvalidStateError')) })
    store({ access: 'old-access', refresh: 'r1' })
    const refresh = vi.fn(() => json(200, { access: 'new-access', refresh: 'r2' }))
    globalThis.fetch = backend(refresh)
    await expect(api.me()).resolves.toEqual({ id: 1 })
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('does not run the refresh twice when the lock ran it and then failed', async () => {
    setLocks({ request: async (name, fn) => { await fn(); throw new Error('lock released badly') } })
    store({ access: 'old-access', refresh: 'r1' })
    const refresh = vi.fn(() => json(200, { access: 'new-access', refresh: 'r2' }))
    globalThis.fetch = backend(refresh)
    await expect(api.me()).resolves.toEqual({ id: 1 })
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})

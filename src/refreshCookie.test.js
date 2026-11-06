// The refresh token in an httpOnly cookie (VITE_REFRESH_COOKIE=1 with the backend's AUTH_REFRESH_COOKIE):
// nothing secret is ever written to localStorage, and a reload gets a fresh access token from the cookie.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const TOKEN_KEY = 'housemaster_tokens'

function json(status, body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
}

async function freshApi() {
  vi.resetModules()
  return (await import('./api.js')).api
}

beforeEach(() => {
  vi.stubEnv('VITE_REFRESH_COOKIE', '1')
  localStorage.clear()
})
afterEach(() => vi.unstubAllEnvs())

describe('refresh token in a cookie', () => {
  it('never stores a token, refreshes from the cookie after a reload, and signs out through it', async () => {
    const calls = []
    globalThis.fetch = vi.fn((url, init = {}) => {
      const path = new URL(url).pathname
      calls.push({ path, init })
      if (path === '/api/token/') return json(200, { access: 'A1', refresh_cookie: true })
      if (path === '/api/token/refresh/') return json(200, { access: 'A2', refresh_cookie: true })
      if (path === '/api/token/logout/') return json(200, { detail: 'Signed out.' })
      if (path === '/api/me/') return init.headers.Authorization === 'Bearer A2' ? json(200, { id: 1 }) : json(401, {})
      return json(404, {})
    })
    let api = await freshApi()
    await api.login('a@b.test', 'pw')
    expect(localStorage.getItem(TOKEN_KEY)).toBe(JSON.stringify({ refresh_cookie: true }))
    expect(calls[0].init.credentials).toBe('include')

    api = await freshApi() // a page reload: the access token in memory is gone
    expect(api.isLoggedIn()).toBe(true)
    await expect(api.me()).resolves.toEqual({ id: 1 })
    const refresh = calls.find((c) => c.path === '/api/token/refresh/')
    expect(refresh.init.credentials).toBe('include')
    expect(refresh.init.headers['X-Requested-With']).toBe('HouseMaster')
    expect(JSON.parse(refresh.init.body)).toEqual({})
    expect(localStorage.getItem(TOKEN_KEY)).not.toContain('A2')

    api.logout()
    const logout = calls.find((c) => c.path === '/api/token/logout/')
    expect(logout.init.credentials).toBe('include')
    expect(api.isLoggedIn()).toBe(false)
  })
})

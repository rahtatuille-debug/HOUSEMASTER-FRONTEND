import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, network } from './api.js'

const TOKEN_KEY = 'housemaster_tokens'
const saved = { ...network }

function json(status, body) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function store(tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

function stored() {
  return JSON.parse(localStorage.getItem(TOKEN_KEY))
}

const offlineError = () => Promise.reject(new TypeError('Failed to fetch'))

// A fetch that never answers until it is aborted, like a request stuck on a
// weak signal.
function hangingFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  Object.assign(network, { timeoutMs: 50, writeTimeoutMs: 50, retryDelaysMs: [1, 1] })
  store({ access: 'a', refresh: 'r' })
})

afterEach(() => {
  Object.assign(network, saved)
})

describe('loading data on a weak signal', () => {
  it('retries a failed load and succeeds when the connection comes back', async () => {
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(offlineError)
      .mockImplementationOnce(offlineError)
      .mockImplementationOnce(() => json(200, { id: 1 }))
    await expect(api.me()).resolves.toEqual({ id: 1 })
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('gives up on a load that hangs, retries it, then reports a clear message', async () => {
    globalThis.fetch = vi.fn(hangingFetch)
    await expect(api.me()).rejects.toThrow(/took too long|could not reach/i)
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('retries while the server is waking up (502, 503, 504)', async () => {
    globalThis.fetch = vi.fn()
      .mockImplementationOnce(() => json(503, {}))
      .mockImplementationOnce(() => json(502, {}))
      .mockImplementationOnce(() => json(200, { id: 1 }))
    await expect(api.me()).resolves.toEqual({ id: 1 })
  })

  it('does not retry a real error such as 404', async () => {
    globalThis.fetch = vi.fn(() => json(404, { detail: 'Not found.' }))
    await expect(api.me()).rejects.toThrow('Not found.')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('saving on a weak signal', () => {
  it('never sends a save twice by itself, so nothing is duplicated', async () => {
    globalThis.fetch = vi.fn(offlineError)
    await expect(api.grades.create({ score: 5 })).rejects.toThrow()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('says a save that timed out may or may not have been saved', async () => {
    globalThis.fetch = vi.fn(hangingFetch)
    const err = await api.grades.create({ score: 5 }).catch((e) => e)
    expect(err.message).toMatch(/may not have been saved|might have been saved/i)
    expect(err.uncertain).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

})

describe('staying signed in on a weak signal', () => {
  it('keeps the session when the connection drops while renewing it', async () => {
    globalThis.fetch = vi.fn((url) => {
      const path = new URL(url).pathname
      if (path === '/api/me/') return json(401, {})
      return offlineError() // /api/token/refresh/ never gets through
    })
    const err = await api.me().catch((e) => e)
    expect(err.isAuthError).toBeFalsy()
    expect(err.message).toMatch(/reach the server|offline/i)
    expect(stored()).toEqual({ access: 'a', refresh: 'r' })
  })

  it('still signs out when the server refuses the refresh token', async () => {
    globalThis.fetch = vi.fn((url) => {
      const path = new URL(url).pathname
      return path === '/api/me/' ? json(401, {}) : json(401, { detail: 'Token is invalid' })
    })
    const err = await api.me().catch((e) => e)
    expect(err.isAuthError).toBe(true)
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })

  it('explains a failed sign-in caused by the connection, not the password', async () => {
    globalThis.fetch = vi.fn(offlineError)
    await expect(api.login('a@example.com', 'pw')).rejects.toThrow(/reach the server|offline/i)
  })
})

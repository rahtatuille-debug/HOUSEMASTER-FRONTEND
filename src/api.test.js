import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api, listFrom } from './api.js'

const TOKEN_KEY = 'housemaster_tokens'

function json(status, body) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function stored() {
  return JSON.parse(localStorage.getItem(TOKEN_KEY))
}

function store(tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

// Routes fetch calls by path; each handler gets (url, init).
function routeFetch(routes) {
  return vi.fn((url, init = {}) => {
    const path = new URL(url).pathname
    const handler = routes[path]
    if (!handler) return json(404, { detail: 'Not found.' })
    return handler(url, init)
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('token refresh', () => {
  it('stores a rotated refresh token when the backend returns one', async () => {
    store({ access: 'old-access', refresh: 'old-refresh' })
    globalThis.fetch = routeFetch({
      '/api/me/': (url, init) =>
        init.headers.Authorization === 'Bearer new-access' ? json(200, { id: 1 }) : json(401, {}),
      '/api/token/refresh/': () => json(200, { access: 'new-access', refresh: 'new-refresh' }),
    })
    await expect(api.me()).resolves.toEqual({ id: 1 })
    expect(stored()).toEqual({ access: 'new-access', refresh: 'new-refresh' })
  })

  it('keeps the old refresh token when the backend does not rotate (current backend)', async () => {
    store({ access: 'old-access', refresh: 'same-refresh' })
    globalThis.fetch = routeFetch({
      '/api/me/': (url, init) =>
        init.headers.Authorization === 'Bearer new-access' ? json(200, { id: 1 }) : json(401, {}),
      '/api/token/refresh/': () => json(200, { access: 'new-access' }),
    })
    await api.me()
    expect(stored()).toEqual({ access: 'new-access', refresh: 'same-refresh' })
  })

  it('shares one refresh between requests that expire at the same time', async () => {
    store({ access: 'old-access', refresh: 'r1' })
    const refresh = vi.fn(() => json(200, { access: 'new-access', refresh: 'r2' }))
    globalThis.fetch = routeFetch({
      '/api/me/': (url, init) =>
        init.headers.Authorization === 'Bearer new-access' ? json(200, { id: 1 }) : json(401, {}),
      '/api/dashboard/': (url, init) =>
        init.headers.Authorization === 'Bearer new-access' ? json(200, { ok: true }) : json(401, {}),
      '/api/token/refresh/': refresh,
    })
    await Promise.all([api.me(), api.dashboard(), api.me()])
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(stored().refresh).toBe('r2')
  })

  it('uses a token another tab already refreshed instead of replaying the old refresh token', async () => {
    store({ access: 'old-access', refresh: 'r1' })
    const refresh = vi.fn(() => json(401, {}))
    globalThis.fetch = routeFetch({
      '/api/me/': (url, init) => {
        if (init.headers.Authorization === 'Bearer tab2-access') return json(200, { id: 1 })
        // While this request was in flight, another tab rotated the tokens.
        store({ access: 'tab2-access', refresh: 'r2' })
        return json(401, {})
      },
      '/api/token/refresh/': refresh,
    })
    await expect(api.me()).resolves.toEqual({ id: 1 })
    expect(refresh).not.toHaveBeenCalled()
    expect(stored()).toEqual({ access: 'tab2-access', refresh: 'r2' })
  })

  it('signs out when the refresh token is refused', async () => {
    store({ access: 'old-access', refresh: 'dead' })
    globalThis.fetch = routeFetch({
      '/api/me/': () => json(401, {}),
      '/api/token/refresh/': () => json(401, {}),
    })
    await expect(api.me()).rejects.toMatchObject({ isAuthError: true })
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('logout', () => {
  it('clears the session and tells the server, best effort', async () => {
    store({ access: 'a', refresh: 'r' })
    const calls = []
    globalThis.fetch = vi.fn((url, init) => {
      calls.push([new URL(url).pathname, JSON.parse(init.body)])
      return json(200, { detail: 'Signed out.' })
    })
    api.logout()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
    expect(calls).toEqual([['/api/logout/', { refresh: 'r' }]])
  })

  it('still signs out locally when the server call fails or the endpoint does not exist', () => {
    store({ access: 'a', refresh: 'r' })
    globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')))
    expect(() => api.logout()).not.toThrow()
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull()
  })
})

describe('list shapes', () => {
  it('returns a plain list unchanged (current backend)', async () => {
    store({ access: 'a', refresh: 'r' })
    globalThis.fetch = routeFetch({ '/api/grades/': () => json(200, [{ id: 1 }, { id: 2 }]) })
    await expect(api.grades.list()).resolves.toEqual([{ id: 1 }, { id: 2 }])
  })

  it('follows page links and returns the whole list (paginated backend)', async () => {
    store({ access: 'a', refresh: 'r' })
    globalThis.fetch = routeFetch({
      '/api/grades/': (url) => {
        const page = new URL(url).searchParams.get('page') || '1'
        if (page === '1') {
          return json(200, { count: 3, next: 'https://api.example.org/api/grades/?page=2&term=4', previous: null,
            results: [{ id: 1 }, { id: 2 }] })
        }
        return json(200, { count: 3, next: null, previous: 'x', results: [{ id: 3 }] })
      },
    })
    await expect(api.grades.list({ term: 4 })).resolves.toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    const secondCall = new URL(globalThis.fetch.mock.calls[1][0])
    expect(secondCall.origin).toBe('http://127.0.0.1:8001')
    expect(secondCall.search).toBe('?page=2&term=4')
  })

  it('leaves the activity log page as it is (that screen pages itself)', async () => {
    store({ access: 'a', refresh: 'r' })
    const page = { count: 60, next: 'https://api.example.org/api/activity/?page=2', previous: null, results: [{ id: 1 }] }
    globalThis.fetch = routeFetch({ '/api/activity/': () => json(200, page) })
    await expect(api.activity.list({ page: 1 })).resolves.toEqual(page)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('asks for large pages', async () => {
    store({ access: 'a', refresh: 'r' })
    globalThis.fetch = routeFetch({ '/api/grades/': () => json(200, []) })
    await api.grades.list({ term: 2 })
    expect(new URL(globalThis.fetch.mock.calls[0][0]).searchParams.get('page_size')).toBe('500')
  })

  it('reads either shape with listFrom', () => {
    expect(listFrom([1, 2])).toEqual([1, 2])
    expect(listFrom({ count: 1, next: null, previous: null, results: [3] })).toEqual([3])
    expect(listFrom(null)).toEqual([])
  })
})

describe('E-1: students', () => {
  it('list() follows the pages, so pickers still get every student from a paging server', async () => {
    store({ access: 'a', refresh: 'r' })
    const calls = []
    globalThis.fetch = routeFetch({
      '/api/students/': (url) => {
        const params = new URL(url).searchParams
        calls.push(Object.fromEntries(params))
        const page = Number(params.get('page') || 1)
        return json(200, { count: 3, next: page === 1 ? 'http://localhost/api/students/?page=2&page_size=500' : null, previous: null,
          results: page === 1 ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }] })
      },
    })
    const rows = await api.students.list({ is_active: true })
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3])
    expect(calls[0].is_active).toBe('true')
  })

  it('page() asks for one page with the filters', async () => {
    store({ access: 'a', refresh: 'r' })
    let seen = null
    globalThis.fetch = routeFetch({
      '/api/students/': (url) => { seen = Object.fromEntries(new URL(url).searchParams); return json(200, { count: 0, next: null, previous: null, results: [] }) },
    })
    await api.students.page({ page: 2, page_size: 50, q: 'ann' })
    expect(seen).toEqual({ page: '2', page_size: '50', q: 'ann' })
  })
})

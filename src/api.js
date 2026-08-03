const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001'

const TOKEN_KEY = 'housemaster_tokens'

function getTokens() {
  const raw = localStorage.getItem(TOKEN_KEY)
  return raw ? JSON.parse(raw) : null
}

function setTokens(tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
}

async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    throw new Error('Incorrect username or password.')
  }
  const tokens = await res.json()
  setTokens(tokens)
  return tokens
}

function logout() {
  clearTokens()
}

async function refreshAccessToken() {
  const tokens = getTokens()
  if (!tokens?.refresh) return null
  const res = await fetch(`${API_BASE}/api/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: tokens.refresh }),
  })
  if (!res.ok) {
    clearTokens()
    return null
  }
  const data = await res.json()
  const updated = { ...tokens, access: data.access }
  setTokens(updated)
  return updated.access
}

// Core request wrapper: attaches the access token, retries once via refresh
// on a 401, and throws a readable Error on any other failure.
async function request(path, { method = 'GET', body, params } = {}) {
  let tokens = getTokens()
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
    ).toString()
    if (qs) url += `?${qs}`
  }

  const doFetch = async (accessToken) =>
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })

  let res = await doFetch(tokens?.access)

  if (res.status === 401 && tokens?.refresh) {
    const newAccess = await refreshAccessToken()
    if (newAccess) {
      res = await doFetch(newAccess)
    }
  }

  if (res.status === 401) {
    clearTokens()
    const err = new Error('Session expired. Please log in again.')
    err.isAuthError = true
    throw err
  }

  if (res.status === 204) return null

  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }

  if (!res.ok) {
    const message =
      (data && (data.detail || Object.values(data).flat().join(' '))) ||
      `Request failed (${res.status})`
    throw new Error(message)
  }

  return data
}

export const api = {
  login,
  logout,
  isLoggedIn: () => !!getTokens()?.access,
  me: () => request('/api/me/'),

  students: {
    list: (params) => request('/api/students/', { params }),
    create: (body) => request('/api/students/', { method: 'POST', body }),
    update: (id, body) => request(`/api/students/${id}/`, { method: 'PATCH', body }),
  },
  schoolClasses: {
    list: () => request('/api/school-classes/'),
  },
  subjects: {
    list: () => request('/api/subjects/'),
    create: (body) => request('/api/subjects/', { method: 'POST', body }),
  },
  terms: {
    list: () => request('/api/terms/'),
    create: (body) => request('/api/terms/', { method: 'POST', body }),
  },
  grades: {
    list: (params) => request('/api/grades/', { params }),
    create: (body) => request('/api/grades/', { method: 'POST', body }),
    update: (id, body) => request(`/api/grades/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/grades/${id}/`, { method: 'DELETE' }),
  },
  reports: {
    list: (params) => request('/api/reports/', { params }),
    generate: (student, term) =>
      request('/api/reports/generate/', { method: 'POST', body: { student, term } }),
    update: (id, body) => request(`/api/reports/${id}/`, { method: 'PATCH', body }),
  },
  schools: {
    mine: () => request('/api/schools/'),
  },
}

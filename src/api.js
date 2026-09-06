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

async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    throw new Error('Incorrect email or password.')
  }
  const tokens = await res.json()
  setTokens(tokens)
  return tokens
}

function logout() {
  clearTokens()
}

async function previewInvite(token) {
  const res = await fetch(`${API_BASE}/api/invites/preview/${token}/`)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'This invite link is invalid.' : 'Could not load invite.')
  }
  return res.json()
}

async function acceptInvite(token, password) {
  const res = await fetch(`${API_BASE}/api/invites/accept/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message =
      (data && (data.detail || Object.values(data).flat().join(' '))) || 'Could not accept invite.'
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }
  setTokens(data)
  return data
}

async function requestPasswordReset(username) {
  const res = await fetch(`${API_BASE}/api/password-reset/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message =
      (data && (data.detail || Object.values(data).flat().join(' '))) ||
      'Could not request a reset link.'
    throw new Error(message)
  }
  return data
}

async function confirmPasswordReset(token, password) {
  const res = await fetch(`${API_BASE}/api/password-reset/confirm/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message =
      (data && (data.detail || Object.values(data).flat().join(' '))) || 'Could not reset password.'
    throw new Error(message)
  }
  return data
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
    const err = new Error(message)
    err.status = res.status
    err.data = data
    throw err
  }

  return data
}

export const api = {
  login,
  logout,
  isLoggedIn: () => !!getTokens()?.access,
  me: () => request('/api/me/'),
  previewInvite,
  acceptInvite,
  requestPasswordReset,
  confirmPasswordReset,

  invites: {
    list: () => request('/api/invites/'),
    create: (body) => request('/api/invites/', { method: 'POST', body }),
    remove: (id) => request(`/api/invites/${id}/`, { method: 'DELETE' }),
  },

  students: {
    list: (params) => request('/api/students/', { params }),
    create: (body) => request('/api/students/', { method: 'POST', body }),
    update: (id, body) => request(`/api/students/${id}/`, { method: 'PATCH', body }),
  },
  schoolClasses: {
    list: () => request('/api/school-classes/'),
    create: (body) => request('/api/school-classes/', { method: 'POST', body }),
    update: (id, body) => request(`/api/school-classes/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/school-classes/${id}/`, { method: 'DELETE' }),
  },
  yearGroups: {
    list: () => request('/api/year-groups/'),
    create: (body) => request('/api/year-groups/', { method: 'POST', body }),
    remove: (id) => request(`/api/year-groups/${id}/`, { method: 'DELETE' }),
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
  announcements: {
    list: (params) => request('/api/announcements/', { params }),
    get: (id) => request(`/api/announcements/${id}/`),
    create: (body) => request('/api/announcements/', { method: 'POST', body }),
    update: (id, body) => request(`/api/announcements/${id}/`, { method: 'PATCH', body }),
    publish: (id) => request(`/api/announcements/${id}/publish/`, { method: 'POST' }),
    archive: (id) => request(`/api/announcements/${id}/archive/`, { method: 'POST' }),
  },
  schools: {
    mine: () => request('/api/schools/'),
  },
}

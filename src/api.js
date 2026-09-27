import { reportApiError } from './sentry.js'

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

async function previewGuardianInvite(token) {
  const res = await fetch(`${API_BASE}/api/guardian-invites/preview/${token}/`)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'This invite link is invalid.' : 'Could not load invite.')
  }
  return res.json()
}

async function acceptGuardianInvite(token, password) {
  const res = await fetch(`${API_BASE}/api/guardian-invites/accept/`, {
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

  let res
  try {
    res = await doFetch(tokens?.access)
  } catch (networkErr) {
    // fetch() only rejects when the request never got a response (backend
    // down, Render cold start timing out, user offline).
    reportApiError(networkErr, { method, path })
    throw new Error('Could not reach the server. Please try again.')
  }

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
    reportApiError(err, { method, path })
    throw err
  }

  return data
}

// For requests that aren't JSON (photo download and upload). Same login
// handling as request(): retries once after refreshing an expired token.
async function authedFetch(path, options = {}) {
  const send = (access) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), ...(access ? { Authorization: `Bearer ${access}` } : {}) },
    })
  let res = await send(getTokens()?.access)
  if (res.status === 401 && getTokens()?.refresh) {
    const access = await refreshAccessToken()
    if (access) res = await send(access)
  }
  return res
}

async function studentPhotoUrl(id) {
  const res = await authedFetch(`/api/students/${id}/photo/`)
  if (!res.ok) return null
  return URL.createObjectURL(await res.blob())
}

async function uploadStudentPhoto(id, file) {
  const form = new FormData()
  form.append('photo', file)
  const res = await authedFetch(`/api/students/${id}/photo/`, { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const message = (data && (data.detail || Object.values(data).flat().join(' '))) || `Upload failed (${res.status})`
    throw new Error(message)
  }
  return data
}

// Download a file (spreadsheet, PDF...) from the API and save it.
async function downloadFile(path, params) {
  const qs = params
    ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null))
    : ''
  const res = await authedFetch(`${path}${qs}`)
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error((data && (data.detail || Object.values(data).flat().join(' '))) || `Download failed (${res.status})`)
  }
  const match = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')
  const url = URL.createObjectURL(await res.blob())
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : 'download'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// POST a multipart form (file uploads) and return the JSON answer.
async function postForm(path, form) {
  const res = await authedFetch(path, { method: 'POST', body: form })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && (data.detail || Object.values(data).flat().join(' '))) || `Upload failed (${res.status})`)
  }
  return data
}

export const api = {
  login,
  logout,
  isLoggedIn: () => !!getTokens()?.access,
  me: () => request('/api/me/'),
  // Admin home page.
  dashboard: () => request('/api/dashboard/'),
  // Graphs data. scope: 'student' | 'class' | 'year_group' | 'school'.
  performance: (params) => request('/api/analytics/performance/', { params }),
  // Excel import (admins). commit=false is a preview: nothing is saved.
  importWorkbook: (file, commit) => {
    const form = new FormData()
    form.append('file', file)
    form.append('commit', commit ? 'true' : 'false')
    return postForm('/api/import/', form)
  },
  downloadImportTemplate: () => downloadFile('/api/import/template/'),
  download: downloadFile,
  updateMe: (body) => request('/api/me/', { method: 'PATCH', body }),
  previewInvite,
  acceptInvite,
  previewGuardianInvite,
  acceptGuardianInvite,
  guardianMe: () => request('/api/guardian-me/'),
  updateGuardianMe: (body) => request('/api/guardian-me/', { method: 'PATCH', body }),
  requestPasswordReset,
  confirmPasswordReset,

  invites: {
    list: () => request('/api/invites/'),
    create: (body) => request('/api/invites/', { method: 'POST', body }),
    remove: (id) => request(`/api/invites/${id}/`, { method: 'DELETE' }),
    // New link and a fresh 7 days; the old link stops working.
    renew: (id) => request(`/api/invites/${id}/renew/`, { method: 'POST' }),
  },

  guardianInvites: {
    list: () => request('/api/guardian-invites/'),
    create: (body) => request('/api/guardian-invites/', { method: 'POST', body }),
    remove: (id) => request(`/api/guardian-invites/${id}/`, { method: 'DELETE' }),
    renew: (id) => request(`/api/guardian-invites/${id}/renew/`, { method: 'POST' }),
  },

  guardianStudents: {
    list: () => request('/api/guardian-students/'),
    get: (id) => request(`/api/guardian-students/${id}/`),
    grades: (id, params) => request(`/api/guardian-students/${id}/grades/`, { params }),
    reports: (id) => request(`/api/guardian-students/${id}/reports/`),
    reportCard: (id, term) => downloadFile(`/api/guardian-students/${id}/report-card/`, { term }),
    profile: (id) => request(`/api/guardian-students/${id}/profile/`),
    photoUrl: async (id) => {
      const res = await authedFetch(`/api/guardian-students/${id}/photo/`)
      return res.ok ? URL.createObjectURL(await res.blob()) : null
    },
  },

  conversations: {
    list: () => request('/api/conversations/'),
    create: (body) => request('/api/conversations/', { method: 'POST', body }),
    messages: (id) => request(`/api/conversations/${id}/messages/`),
    sendMessage: (id, body) => request(`/api/conversations/${id}/messages/`, { method: 'POST', body }),
    markRead: (id) => request(`/api/conversations/${id}/read/`, { method: 'POST' }),
    contacts: () => request('/api/conversations/contacts/'),
    // Every parent of one class. kind: 'class_notice' (one-way) or 'class_group' (discussion).
    messageClass: (body) => request('/api/conversations/class/', { method: 'POST', body }),
  },

  alerts: {
    list: () => request('/api/alerts/'),
    active: () => request('/api/alerts/active/'),
    create: (body) => request('/api/alerts/', { method: 'POST', body }),
    acknowledge: (id) => request(`/api/alerts/${id}/acknowledge/`, { method: 'POST' }),
    recipients: (id) => request(`/api/alerts/${id}/recipients/`),
    end: (id) => request(`/api/alerts/${id}/end/`, { method: 'POST' }),
  },

  students: {
    list: (params) => request('/api/students/', { params }),
    create: (body) => request('/api/students/', { method: 'POST', body }),
    update: (id, body) => request(`/api/students/${id}/`, { method: 'PATCH', body }),
    // Permanent. For a teacher this only sends a request for an admin to approve.
    remove: (id, reason) => request(`/api/students/${id}/`, { method: 'DELETE', body: reason ? { reason } : undefined }),
    // Everything the student profile page shows.
    profile: (id) => request(`/api/students/${id}/profile/`),
    // Returns an object URL for an <img>, or null if there's no photo.
    photoUrl: studentPhotoUrl,
    uploadPhoto: uploadStudentPhoto,
    removePhoto: (id) => request(`/api/students/${id}/photo/`, { method: 'DELETE' }),
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
    update: (id, body) => request(`/api/year-groups/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/year-groups/${id}/`, { method: 'DELETE' }),
  },
  subjects: {
    list: () => request('/api/subjects/'),
    create: (body) => request('/api/subjects/', { method: 'POST', body }),
    update: (id, body) => request(`/api/subjects/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/subjects/${id}/`, { method: 'DELETE' }),
  },
  terms: {
    list: () => request('/api/terms/'),
    create: (body) => request('/api/terms/', { method: 'POST', body }),
    update: (id, body) => request(`/api/terms/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/terms/${id}/`, { method: 'DELETE' }),
    // Admins. A locked term's grades, reports and attendance can't change.
    lock: (id) => request(`/api/terms/${id}/lock/`, { method: 'POST' }),
    unlock: (id) => request(`/api/terms/${id}/unlock/`, { method: 'POST' }),
  },
  // End of year (admins): moves = [{ from_class, to_class or null for leaving }].
  promotion: (moves, commit) => request('/api/promotion/', { method: 'POST', body: { moves, commit } }),
  attendance: {
    list: (params) => request('/api/attendance/', { params }),
    create: (body) => request('/api/attendance/', { method: 'POST', body }),
    update: (id, body) => request(`/api/attendance/${id}/`, { method: 'PATCH', body }),
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
    submit: (id) => request(`/api/reports/${id}/submit/`, { method: 'POST' }),
    finalize: (id) => request(`/api/reports/${id}/finalize/`, { method: 'POST' }),
    sendBack: (id, note) => request(`/api/reports/${id}/send-back/`, { method: 'POST', body: { note } }),
    // Whole class: start a run, then generate one student at a time with its token.
    generateClass: (school_class, term) =>
      request('/api/reports/generate-class/', { method: 'POST', body: { school_class, term } }),
    generateClassNext: (run, student) =>
      request('/api/reports/generate-class/next/', { method: 'POST', body: { run, student } }),
    submitClass: (school_class, term) =>
      request('/api/reports/submit-class/', { method: 'POST', body: { school_class, term } }),
    finalizeClass: (school_class, term) =>
      request('/api/reports/finalize-class/', { method: 'POST', body: { school_class, term } }),
  },
  announcements: {
    list: (params) => request('/api/announcements/', { params }),
    get: (id) => request(`/api/announcements/${id}/`),
    create: (body) => request('/api/announcements/', { method: 'POST', body }),
    update: (id, body) => request(`/api/announcements/${id}/`, { method: 'PATCH', body }),
    publish: (id) => request(`/api/announcements/${id}/publish/`, { method: 'POST' }),
    archive: (id) => request(`/api/announcements/${id}/archive/`, { method: 'POST' }),
    generateText: (body) => request('/api/announcements/generate-text/', { method: 'POST', body }),
  },
  schools: {
    mine: () => request('/api/schools/'),
    update: (id, body) => request(`/api/schools/${id}/`, { method: 'PATCH', body }),
  },

  // Admin only.
  staff: {
    list: () => request('/api/staff/'),
    setRole: (id, role) => request(`/api/staff/${id}/`, { method: 'PATCH', body: { role } }),
    deactivate: (id) => request(`/api/staff/${id}/deactivate/`, { method: 'POST' }),
    reactivate: (id) => request(`/api/staff/${id}/reactivate/`, { method: 'POST' }),
    sendPasswordReset: (id) => request(`/api/staff/${id}/send-password-reset/`, { method: 'POST' }),
  },
  teachingAssignments: {
    list: (params) => request('/api/teaching-assignments/', { params }),
    create: (body) => request('/api/teaching-assignments/', { method: 'POST', body }),
    remove: (id) => request(`/api/teaching-assignments/${id}/`, { method: 'DELETE' }),
  },
  parents: {
    list: () => request('/api/parents/'),
    setStudents: (id, students) => request(`/api/parents/${id}/`, { method: 'PATCH', body: { students } }),
    updateContact: (id, body) => request(`/api/parents/${id}/`, { method: 'PATCH', body }),
    deactivate: (id) => request(`/api/parents/${id}/deactivate/`, { method: 'POST' }),
    reactivate: (id) => request(`/api/parents/${id}/reactivate/`, { method: 'POST' }),
    sendPasswordReset: (id) => request(`/api/parents/${id}/send-password-reset/`, { method: 'POST' }),
  },
  activity: {
    list: (params) => request('/api/activity/', { params }),
  },

  // Admins see and decide every request; teachers see and cancel their own.
  changeRequests: {
    list: (params) => request('/api/change-requests/', { params }),
    approve: (id, note) => request(`/api/change-requests/${id}/approve/`, { method: 'POST', body: { note } }),
    reject: (id, note) => request(`/api/change-requests/${id}/reject/`, { method: 'POST', body: { note } }),
    cancel: (id) => request(`/api/change-requests/${id}/cancel/`, { method: 'POST' }),
  },
}

// When a teacher makes a change that needs an admin's approval, the API
// answers 202 with { detail, change_request } instead of the saved object.
export function needsApproval(result) {
  return Boolean(result && result.change_request)
}

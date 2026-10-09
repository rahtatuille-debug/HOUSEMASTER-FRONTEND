import { reportApiError } from './sentry.js'
import { browserOffline, connection } from './connection.js'
import { clearDrafts } from './drafts.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8001'

const TOKEN_KEY = 'housemaster_tokens'

// Weak-signal handling. A request that gets no answer is given up after
// timeoutMs; loading data is then tried again after each retryDelaysMs
// (together about a minute, long enough for a sleeping Render server to
// wake). Saves are never sent twice by the app itself: one that reached the
// server but lost its answer would otherwise be made twice.
export const network = { timeoutMs: 20000, writeTimeoutMs: 30000, retryDelaysMs: [1000, 3000] }

// Answers from a proxy while the server is starting or overloaded.
const RETRY_STATUSES = new Set([502, 503, 504])

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchWithTimeout(url, init, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (controller.signal.aborted) {
      const timedOut = new Error('Request timed out')
      timedOut.timedOut = true
      throw timedOut
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

// The message for a request that never got an answer. For a save it matters
// whether it might have reached the server, so the person knows whether to
// check before trying again.
function networkFailure(cause, isRead) {
  let message
  let uncertain = false
  if (browserOffline()) {
    message = isRead
      ? 'You’re offline. This will load when you’re back online.'
      : 'You’re offline, so this was not saved. Try again when you’re back online.'
  } else if (isRead) {
    message = cause?.timedOut
      ? 'The connection is weak and this took too long to load. Please try again.'
      : 'Could not reach the server. Please try again.'
  } else {
    uncertain = true
    message = 'The connection dropped before the server answered, so this may not have been saved. ' +
      'Check before trying again.'
  }
  const err = new Error(message)
  err.network = true
  err.uncertain = uncertain
  return err
}

function getTokens() {
  try {
    const raw = localStorage.getItem(TOKEN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function setTokens(tokens) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens))
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY)
}

async function login(email, password) {
  let res
  try {
    res = await fetchWithTimeout(`${API_BASE}/api/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }, network.writeTimeoutMs)
  } catch {
    connection.report(false)
    throw new Error(browserOffline()
      ? 'You’re offline. Connect to the internet to sign in.'
      : 'Could not reach the server. Check your connection and try again.')
  }
  connection.report(true)
  if (!res.ok) {
    throw new Error('Incorrect email or password.')
  }
  const tokens = await res.json()
  setTokens(tokens)
  return tokens
}

// Signs out on this device straight away, then asks the server to retire the
// refresh token too. That second part is best effort: the device is signed
// out whether or not it reaches the server (an older backend without
// /api/logout/ just answers 404).
function logout() {
  const refresh = getTokens()?.refresh
  clearTokens()
  clearLease()
  clearDrafts()
  if (!refresh) return
  try {
    fetch(`${API_BASE}/api/logout/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore: signing out locally is what matters
  }
}

async function previewGuardianInvite(token) {
  const res = await fetch(`${API_BASE}/api/guardian-invites/preview/${token}/`)
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'This invite link is invalid.' : 'Could not load invite.')
  }
  return res.json()
}

// A class sign-up link (public): what it's for, and asking to join.
async function joinInfo(token) {
  const res = await fetch(`${API_BASE}/api/join/${token}/`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.detail || 'This sign-up link isn\'t working.')
  return data
}

async function joinClass(token, body) {
  const res = await fetch(`${API_BASE}/api/join/${token}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && (data.detail || Object.values(data).flat().join(' '))) || `Sign-up failed (${res.status})`)
  }
  return data
}

// Admissions: a school's public application form (no account needed).
async function applyInfo(token) {
  const res = await fetch(`${API_BASE}/api/admissions/apply/${token}/`)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.detail || "This application form isn't open.")
  return data
}

async function submitApplication(token, body) {
  const res = await fetch(`${API_BASE}/api/admissions/apply/${token}/`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && (data.detail || Object.values(data).flat().join(' '))) || `Sending failed (${res.status})`)
  }
  return data
}

// The link in the confirmation email: sends the application to the school (once).
async function confirmApplication(token) {
  const res = await fetch(`${API_BASE}/api/admissions/confirm/${token}/`, { method: 'POST' })
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error((data && (data.detail || Object.values(data).flat().join(' '))) || `Confirming failed (${res.status})`)
  }
  return data
}

async function acceptGuardianInvite(token, password, acceptPrivacy = false) {
  const res = await fetch(`${API_BASE}/api/guardian-invites/accept/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, accept_privacy: acceptPrivacy }),
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

// Public: create a new school and its first admin, then sign them in.
async function registerSchool(body) {
  const res = await fetch(`${API_BASE}/api/schools/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message = res.status === 429
      ? 'Too many sign-ups from this network. Please try again in an hour.'
      : (data && (data.detail || Object.values(data).flat().join(' '))) || 'Could not register the school.'
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

async function acceptInvite(token, password, acceptPrivacy = false) {
  const res = await fetch(`${API_BASE}/api/invites/accept/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password, accept_privacy: acceptPrivacy }),
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

// "Too many requests" from the rate limits (F-05). Retry-After is in seconds.
function waitMessage(res, what) {
  const seconds = Number(res.headers.get('Retry-After'))
  let wait = 'a little while'
  if (Number.isFinite(seconds) && seconds > 0) {
    const minutes = Math.ceil(seconds / 60)
    wait = minutes <= 1 ? 'a minute' : `${minutes} minutes`
  }
  return `There have been too many ${what} from here. Please wait ${wait} and try again.`
}

async function publicPost(path, body, fallback, what) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message = res.status === 429
      ? waitMessage(res, what)
      : (data && (data.detail || Object.values(data).flat().join(' '))) || fallback
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return data
}

// The API asks for the account's email address and answers the same way
// whether or not an account uses it.
function requestPasswordReset(email) {
  return publicPost('/api/password-reset/', { email }, 'Could not request a reset link.', 'reset requests')
}

function confirmPasswordReset(token, password) {
  return publicPost('/api/password-reset/confirm/', { token, password }, 'Could not reset password.', 'attempts')
}

// Trades the refresh token for a new access token. The backend may rotate
// the refresh token (it returns a new one and retires the old one), so a
// returned `refresh` is always stored.
//
// Only one refresh runs at a time: requests that hit an expired token
// together share it, and a Web Lock does the same across tabs. Reusing a
// retired refresh token would sign the user out, so before refreshing we
// check whether another request or tab already got a new access token.
let refreshInFlight = null

async function refreshAccessToken(staleAccess) {
  if (!refreshInFlight) {
    refreshInFlight = withRefreshLock(() => doRefresh(staleAccess)).finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// Across tabs, a Web Lock makes one tab refresh while the others wait. Where
// there are no Web Locks (older Safari) or they throw (some privacy modes),
// a short lease in localStorage does the same job, best effort: a tab that
// finds another tab's lease waits for the new tokens to appear (or the lease
// to run out) and then uses them. The refresh itself never runs twice.
function withRefreshLock(fn) {
  let started = false
  let result
  const once = () => {
    if (!started) {
      started = true
      result = fn()
    }
    return result
  }
  const fallback = () => (started ? result : withStorageLease(once))
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return fallback()
  try {
    return Promise.resolve(navigator.locks.request('housemaster-token-refresh', once)).catch(fallback)
  } catch {
    return fallback()
  }
}

const LEASE_KEY = 'housemaster_refresh_lease'
const LEASE_MS = 10000

function readLease() {
  try {
    return JSON.parse(localStorage.getItem(LEASE_KEY))
  } catch {
    return null
  }
}

function clearLease(id) {
  try {
    if (id === undefined || readLease()?.id === id) localStorage.removeItem(LEASE_KEY)
  } catch {
    // storage unavailable: nothing to clear
  }
}

// Resolves when another tab writes new tokens, or after `ms`.
function tokensChangeOrTimeout(ms) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer)
      window.removeEventListener('storage', onStorage)
      resolve()
    }
    const onStorage = (event) => {
      if (event.key === TOKEN_KEY || event.key === LEASE_KEY) done()
    }
    const timer = setTimeout(done, Math.max(0, ms))
    window.addEventListener('storage', onStorage)
  })
}

async function withStorageLease(fn) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  try {
    const lease = readLease()
    if (lease && lease.id !== id && lease.until > Date.now()) {
      // Another tab is refreshing. doRefresh then finds its new access token.
      await tokensChangeOrTimeout(lease.until - Date.now())
    } else {
      localStorage.setItem(LEASE_KEY, JSON.stringify({ id, until: Date.now() + LEASE_MS }))
    }
  } catch {
    // no usable storage: refresh without cross-tab coordination
  }
  try {
    return await fn()
  } finally {
    clearLease(id)
  }
}

async function doRefresh(staleAccess) {
  const tokens = getTokens()
  if (!tokens?.refresh) return null
  // Someone else refreshed while we waited: use their access token.
  if (staleAccess !== undefined && tokens.access && tokens.access !== staleAccess) {
    return tokens.access
  }
  // A refresh that never got an answer throws: the session may be fine, so
  // it must not be treated like a refused token (which signs out).
  const res = await fetchWithTimeout(`${API_BASE}/api/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: tokens.refresh }),
  }, network.timeoutMs)
  if (!res.ok) {
    // Another tab may have rotated the token a moment ago (browsers without
    // Web Locks); only sign out if the stored token is still the one that
    // was refused.
    const now = getTokens()
    if (now?.refresh && now.refresh !== tokens.refresh) return now.access || null
    clearTokens()
    return null
  }
  const data = await res.json()
  setTokens({ ...tokens, access: data.access, ...(data.refresh ? { refresh: data.refresh } : {}) })
  return data.access
}

// Core request wrapper: attaches the access token, retries once via refresh
// on a 401, and throws a readable Error on any other failure. Loading data is
// retried on a weak signal; saves are sent once (see `network`).
async function request(path, { method = 'GET', body, params } = {}) {
  let tokens = getTokens()
  let url = `${API_BASE}${path}`
  if (params) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null)
    ).toString()
    if (qs) url += `?${qs}`
  }
  const isRead = method === 'GET'

  const send = async (accessToken) => {
    const init = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }
    const delays = isRead ? network.retryDelaysMs : []
    for (let attempt = 0; ; attempt++) {
      let res
      try {
        res = await fetchWithTimeout(url, init, isRead ? network.timeoutMs : network.writeTimeoutMs)
      } catch (networkErr) {
        // No answer at all: offline, a weak signal, or the server asleep.
        connection.report(false)
        if (attempt < delays.length) {
          await wait(delays[attempt])
          continue
        }
        if (!browserOffline()) reportApiError(networkErr, { method, path })
        throw networkFailure(networkErr, isRead)
      }
      connection.report(true)
      if (RETRY_STATUSES.has(res.status) && attempt < delays.length) {
        await wait(delays[attempt])
        continue
      }
      return res
    }
  }

  let res = await send(tokens?.access)

  if (res.status === 401 && tokens?.refresh) {
    let newAccess
    try {
      newAccess = await refreshAccessToken(tokens?.access)
    } catch (networkErr) {
      connection.report(false)
      throw networkFailure(networkErr, isRead)
    }
    if (newAccess) {
      res = await send(newAccess)
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
  const used = getTokens()?.access
  let res = await send(used)
  if (res.status === 401 && getTokens()?.refresh) {
    const access = await refreshAccessToken(used)
    if (access) res = await send(access)
  }
  return res
}

// Lists may come back whole (a plain array) or a page at a time
// ({count, next, previous, results}). listRequest() always returns the
// whole list as an array, following `next` links in bounded chunks, so the
// screens work the same either way.
// Ask for the largest page the backend allows (a plain list ignores it),
// and stop after this many pages rather than loop forever.
const LIST_PAGE_SIZE = 500
const MAX_LIST_PAGES = 100

function samePath(nextUrl) {
  try {
    const url = new URL(nextUrl, API_BASE)
    return `${url.pathname}${url.search}`
  } catch {
    return null
  }
}

export function isPage(data) {
  return !!data && !Array.isArray(data) && Array.isArray(data.results)
}

// How many rows a list response describes: the page's count, or the
// length of a whole list from an older backend.
export function countOf(data) {
  if (isPage(data)) return data.count
  return Array.isArray(data) ? data.length : 0
}

export function listFrom(data) {
  if (Array.isArray(data)) return data
  if (isPage(data)) return data.results
  return []
}

async function listRequest(path, options = {}) {
  const first = await request(path, { ...options, params: { page_size: LIST_PAGE_SIZE, ...(options.params || {}) } })
  if (!isPage(first)) return first
  const rows = [...first.results]
  let next = first.next
  for (let page = 1; next && page < MAX_LIST_PAGES; page += 1) {
    const nextPath = samePath(next)
    if (!nextPath) break
    const data = await request(nextPath)
    rows.push(...listFrom(data))
    next = isPage(data) ? data.next : null
  }
  return rows
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

// The setup wizard's sample report card: a PDF made from the answers so far, as a Blob.
async function previewReportCard(body) {
  const res = await authedFetch('/api/setup/preview-report/', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error((data && (data.detail || Object.values(data).flat().join(' '))) || `Preview failed (${res.status})`)
  }
  return res.blob()
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

// Is the server answering at all? Used by the offline banner to notice the
// signal coming back. /healthz sends no CORS headers, so the answer is read
// as opaque: any answer counts, only no answer means unreachable.
async function ping() {
  try {
    await fetchWithTimeout(`${API_BASE}/healthz`, { method: 'GET', mode: 'no-cors', cache: 'no-store' }, 8000)
    connection.report(true)
    return true
  } catch {
    return false
  }
}

export const api = {
  ping,
  login,
  logout,
  isLoggedIn: () => !!getTokens()?.access,
  me: () => request('/api/me/'),
  // Admin home page.
  dashboard: () => request('/api/dashboard/'),
  // School-wide figures for governors and leaders: numbers only.
  governorSummary: () => request('/api/governor/summary/'),
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
  importStaff: (file, commit, sendEmails = false) => {
    const form = new FormData()
    form.append('file', file)
    form.append('commit', commit ? 'true' : 'false')
    form.append('send_emails', sendEmails ? 'true' : 'false')
    return postForm('/api/import/staff/', form)
  },
  downloadStaffTemplate: () => downloadFile('/api/import/staff-template/'),
  download: downloadFile,
  updateMe: (body) => request('/api/me/', { method: 'PATCH', body }),
  registerSchool,
  teacherHome: {
    get: () => request('/api/teacher-home/'),
    setHidden: (hidden) => request('/api/teacher-home/', { method: 'PATCH', body: { hidden } }),
    // Each of my classes' average and position in its year group, overall and per subject.
    performance: (term) => request('/api/teacher-home/performance/', { params: term ? { term } : undefined }),
    // Every class's average and position in its year group, and its subject averages. No students.
    allClasses: (term) => request('/api/teacher-home/all-classes/', { params: term ? { term } : undefined }),
  },
  tourSeen: () => request('/api/tour-seen/', { method: 'POST' }),
  checklist: {
    get: () => request('/api/checklist/'),
    setHidden: (hidden) => request('/api/checklist/', { method: 'PATCH', body: { hidden } }),
  },
  setup: {
    state: () => request('/api/setup/'),
    saveProgress: (progress) => request('/api/setup/', { method: 'PATCH', body: { progress } }),
    finish: (body) => request('/api/setup/finish/', { method: 'POST', body }),
    addSection: (body) => request('/api/setup/add-section/', { method: 'POST', body }),
    previewReport: previewReportCard,
    people: () => request('/api/setup/people/'),
    complete: () => request('/api/setup/complete/', { method: 'POST' }),
  },
  previewInvite,
  acceptInvite,
  previewGuardianInvite,
  acceptGuardianInvite,
  joinInfo,
  joinClass,
  applyInfo,
  submitApplication,
  confirmApplication,
  admissions: {
    // params: { status } for confirmed applications, or { unconfirmed: 1 } for those waiting for the family's email
    list: (params) => listRequest('/api/admissions/applications/', { params }),
    update: (id, body) => request(`/api/admissions/applications/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/admissions/applications/${id}/`, { method: 'DELETE' }),
    // opts.differentChild: the admin confirmed that a student with the same name and birthday is someone else.
    enrol: (id, schoolClass, opts) => request(`/api/admissions/applications/${id}/enrol/`, { method: 'POST',
      body: { school_class: schoolClass, ...(opts?.differentChild ? { different_child: true } : {}) } }),
    summary: () => request('/api/admissions/applications/summary/'),
    settings: () => request('/api/admissions/settings/'),
    saveSettings: (body) => request('/api/admissions/settings/', { method: 'PATCH', body }),
    newLink: () => request('/api/admissions/settings/', { method: 'POST', body: { new_link: true } }),
  },
  signupLinks: {
    list: () => request('/api/signup-links/'),
    change: (schoolClass, action) => request('/api/signup-links/', { method: 'POST', body: { school_class: schoolClass, action } }),
    turnOnAll: () => request('/api/signup-links/', { method: 'POST', body: { action: 'create_all' } }),
  },
  signupRequests: {
    list: (status = 'pending') => request(`/api/signup-requests/?status=${status}`),
    decide: (ids, decision) => request('/api/signup-requests/', { method: 'POST', body: { ids, decision } }),
  },
  guardianMe: () => request('/api/guardian-me/'),
  // A student's own account (studentaccounts).
  student: {
    me: () => request('/api/student/me/'),
    // { current_password, new_password }: answers with new sign-in tokens, kept here.
    changePassword: async (body) => {
      const tokens = await request('/api/student/password/', { method: 'POST', body })
      if (tokens?.access) setTokens(tokens)
      return tokens
    },
    // { done, answer }
    handIn: (assignmentId, body) => request(`/api/student/homework/${assignmentId}/`, { method: 'POST', body }),
  },
  // Staff making and managing student logins.
  studentAccounts: {
    list: (params) => request('/api/student-accounts/', { params }),
    create: (students) => request('/api/student-accounts/', { method: 'POST', body: { students } }),
    reset: (studentId) => request(`/api/student-accounts/${studentId}/reset/`, { method: 'POST' }),
    disable: (studentId) => request(`/api/student-accounts/${studentId}/disable/`, { method: 'POST' }),
    enable: (studentId) => request(`/api/student-accounts/${studentId}/enable/`, { method: 'POST' }),
    remove: (studentId) => request(`/api/student-accounts/${studentId}/`, { method: 'DELETE' }),
  },
  updateGuardianMe: (body) => request('/api/guardian-me/', { method: 'PATCH', body }),
  // Phone and browser notifications for this device (src/push.js).
  push: {
    settings: (endpoint) => request('/api/push/', { params: endpoint ? { endpoint } : undefined }),
    subscribe: (subscription) => request('/api/push/subscribe/', { method: 'POST', body: subscription }),
    unsubscribe: (endpoint) => request('/api/push/unsubscribe/', { method: 'POST', body: { endpoint } }),
  },
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
    termSummary: (id, term) => request(`/api/guardian-students/${id}/term-summary/`, { params: { term } }),
    profile: (id) => request(`/api/guardian-students/${id}/profile/`),
    timetable: (id) => request(`/api/guardian-students/${id}/timetable/`),
    boarding: (id) => request(`/api/guardian-students/${id}/boarding/`),
    requestLeave: (id, body) => request(`/api/guardian-students/${id}/leave-requests/`, { method: 'POST', body }),
    cancelLeave: (id, leaveId) => request(`/api/guardian-students/${id}/leave-requests/${leaveId}/cancel/`, { method: 'POST' }),
    // Absences: what's been reported for this child; a parent reports one { start_date, end_date, reason, details }.
    absences: (id) => request(`/api/guardian-students/${id}/absences/`),
    reportAbsence: (id, body) => request(`/api/guardian-students/${id}/absences/`, { method: 'POST', body }),
    cancelAbsence: (id, reportId) => request(`/api/guardian-students/${id}/absences/${reportId}/cancel/`, { method: 'POST' }),
    // A parent's suggestion for the health notes, which the school approves.
    suggestHealthNotes: (id, body) => request(`/api/guardian-students/${id}/health-notes-request/`, { method: 'POST', body }),
    withdrawHealthNotes: (id) => request(`/api/guardian-students/${id}/health-notes-request/`, { method: 'DELETE' }),
    photoUrl: async (id) => {
      const res = await authedFetch(`/api/guardian-students/${id}/photo/`)
      return res.ok ? URL.createObjectURL(await res.blob()) : null
    },
  },

  conversations: {
    list: () => listRequest('/api/conversations/'),
    create: (body) => request('/api/conversations/', { method: 'POST', body }),
    messages: (id) => listRequest(`/api/conversations/${id}/messages/`),
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
    // Every student matching the filters (follows the pages when the server pages; E-1).
    list: (params) => listRequest('/api/students/', { params }),
    // One page: { page, page_size, q, school_class, is_active, needs_support }. An older server sends the whole list.
    page: (params) => request('/api/students/', { params }),
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
    // Data protection requests (admins).
    dataExport: (id) => downloadFile(`/api/students/${id}/data-export/`),
    termSummary: (id, term) => request(`/api/students/${id}/term-summary/`, { params: { term } }),
    removePersonalData: (id, confirmName) =>
      request(`/api/students/${id}/remove-personal-data/`, { method: 'POST', body: { confirm_name: confirmName } }),
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
  subjectChoices: {
    get: (school_class) => request('/api/subject-choices/', { params: { school_class } }),
    save: (school_class, students) =>
      request('/api/subject-choices/', { method: 'POST', body: { school_class: Number(school_class), students } }),
  },
  assessmentTypes: {
    list: () => request('/api/assessment-types/'),
    create: (body) => request('/api/assessment-types/', { method: 'POST', body }),
    update: (id, body) => request(`/api/assessment-types/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/assessment-types/${id}/`, { method: 'DELETE' }),
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
    list: (params) => listRequest('/api/attendance/', { params }),
    create: (body) => request('/api/attendance/', { method: 'POST', body }),
    update: (id, body) => request(`/api/attendance/${id}/`, { method: 'PATCH', body }),
    // Every class's register for a day: { date, classes: [{ id, name, students, marked, present, late, absent }], totals }.
    summary: (date) => request('/api/attendance/summary/', { params: date ? { date } : undefined }),
  },
  grades: {
    list: (params) => listRequest('/api/grades/', { params }),
    // One page from the server ({count, next, results}), or a plain list from an older backend.
    page: (params) => request('/api/grades/', { params }),
    create: (body) => request('/api/grades/', { method: 'POST', body }),
    update: (id, body) => request(`/api/grades/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/grades/${id}/`, { method: 'DELETE' }),
  },
  subjectReports: {
    list: (params) => request('/api/subject-reports/', { params }),
    save: (body) => request('/api/subject-reports/', { method: 'POST', body }),
  },
  reports: {
    // Reports, announcements and change requests: page() asks for one page
    // (F-4); list() still returns the whole list, whichever way the backend
    // sends it.
    list: (params) => listRequest('/api/reports/', { params }),
    page: (params) => request('/api/reports/', { params }),
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
    // Reports waiting for approval, grouped by term, year group and class.
    waiting: () => request('/api/reports/waiting/'),
    // { term, school_class } or { term, year_group }: finalize every waiting report there.
    approveAll: (body) => request('/api/reports/approve-all/', { method: 'POST', body }),
  },
  announcements: {
    list: (params) => listRequest('/api/announcements/', { params }),
    page: (params) => request('/api/announcements/', { params }),
    get: (id) => request(`/api/announcements/${id}/`),
    create: (body) => request('/api/announcements/', { method: 'POST', body }),
    update: (id, body) => request(`/api/announcements/${id}/`, { method: 'PATCH', body }),
    publish: (id) => request(`/api/announcements/${id}/publish/`, { method: 'POST' }),
    archive: (id) => request(`/api/announcements/${id}/archive/`, { method: 'POST' }),
    generateText: (body) => request('/api/announcements/generate-text/', { method: 'POST', body }),
  },
  // Boarding: house staff and admins.
  boarding: {
    overview: () => request('/api/boarding/overview/'),
    boarders: (house) => request('/api/boarding/boarders/', { params: house ? { house } : undefined }),
    students: (q) => request('/api/boarding/students/', { params: { q } }),
    // Students marked as boarders who have no bed yet.
    unbedded: () => request('/api/boarding/unbedded/'),
    houses: {
      // params: { archived: 1 } for archived houses (their history stays readable)
      list: (params) => request('/api/boarding/houses/', { params }),
      create: (body) => request('/api/boarding/houses/', { method: 'POST', body }),
      update: (id, body) => request(`/api/boarding/houses/${id}/`, { method: 'PATCH', body }),
      remove: (id) => request(`/api/boarding/houses/${id}/`, { method: 'DELETE' }),
      // A house with history can't be deleted: archive it instead.
      archive: (id) => request(`/api/boarding/houses/${id}/archive/`, { method: 'POST' }),
      unarchive: (id) => request(`/api/boarding/houses/${id}/unarchive/`, { method: 'POST' }),
      // Put the house's allocated boarders who have no bed in its free beds, at random.
      fillBeds: (id) => request(`/api/boarding/houses/${id}/fill-beds/`, { method: 'POST' }),
    },
    // Which boarding house each boarder belongs to. Admins allocate (house: id, or null for none).
    allocations: {
      list: () => request('/api/boarding/allocations/'),
      allocate: (students, house) => request('/api/boarding/allocations/', { method: 'POST', body: { students, house } }),
    },
    dorms: {
      create: (body) => request('/api/boarding/dorms/', { method: 'POST', body }),
      remove: (id) => request(`/api/boarding/dorms/${id}/`, { method: 'DELETE' }),
      addBeds: (id, count) => request(`/api/boarding/dorms/${id}/beds/`, { method: 'POST', body: { count } }),
    },
    // student: an id to put them in the bed, or null to empty it
    // opts.replace: the bed is taken and the admin chose to move its occupant out (they then need a bed).
    assignBed: (bed, student, opts) => request(`/api/boarding/beds/${bed}/`, { method: 'POST', body: { student, ...(opts?.replace ? { replace: true } : {}) } }),
    removeBed: (bed) => request(`/api/boarding/beds/${bed}/`, { method: 'DELETE' }),
    rollCalls: {
      list: (params) => listRequest('/api/boarding/roll-calls/', { params }),
      get: (id) => request(`/api/boarding/roll-calls/${id}/`),
      start: (house, session) => request('/api/boarding/roll-calls/', { method: 'POST', body: { house, session } }),
      mark: (id, entries, complete) => request(`/api/boarding/roll-calls/${id}/mark/`, { method: 'POST', body: { entries, complete } }),
      // Admins only, for a finished roll call: recorded with the reason and before/after.
      amend: (id, entries, reason) => request(`/api/boarding/roll-calls/${id}/amend/`, { method: 'POST', body: { entries, reason } }),
    },
    // A boarder marked missing stays open until a person resolves it (a later roll call never closes it).
    absences: {
      list: (params) => listRequest('/api/boarding/absences/', { params }),
      // resolution: found, returned, on_leave or left_school
      resolve: (id, resolution, note) => request(`/api/boarding/absences/${id}/resolve/`, { method: 'POST', body: { resolution, note } }),
    },
    // Boarders whose leave only an admin may give, approve or sign out. Staff read; admins set {student, leave_admin_only, note}.
    restrictions: {
      list: () => request('/api/boarding/restrictions/'),
      set: (body) => request('/api/boarding/restrictions/', { method: 'POST', body }),
    },
    leave: {
      list: (params) => listRequest('/api/boarding/leave/', { params }),
      create: (body) => request('/api/boarding/leave/', { method: 'POST', body }),
      act: (id, verb, note) => request(`/api/boarding/leave/${id}/${verb}/`, { method: 'POST', body: note ? { note } : {} }),
    },
    sickBay: {
      list: (params) => listRequest('/api/boarding/sick-bay/', { params }),
      checkIn: (body) => request('/api/boarding/sick-bay/', { method: 'POST', body }),
      update: (id, body) => request(`/api/boarding/sick-bay/${id}/`, { method: 'PATCH', body }),
      checkOut: (id, outcome) => request(`/api/boarding/sick-bay/${id}/check-out/`, { method: 'POST', body: { outcome } }),
      told: (id, body) => request(`/api/boarding/sick-bay/${id}/told/`, { method: 'POST', body }),
    },
  },
  // The timetable: admins change it, all staff read it.
  timetable: {
    week: (params) => request('/api/timetable/week/', { params }),
    // Staff cover (admins and leadership).
    absences: {
      list: (params) => request('/api/timetable/absences/', { params }),
      // { teacher, start_date, end_date, periods: [ids] (one day only), reason, note }
      create: (body) => request('/api/timetable/absences/', { method: 'POST', body }),
      remove: (id) => request(`/api/timetable/absences/${id}/`, { method: 'DELETE' }),
    },
    cover: {
      day: (date) => request('/api/timetable/cover/', { params: date ? { date } : undefined }),
      // { lesson, date, cover_teacher (null: supervised another way), note }
      arrange: (body) => request('/api/timetable/cover/', { method: 'POST', body }),
      remove: (lesson, date) => request('/api/timetable/cover/', { method: 'DELETE', params: { lesson, date } }),
    },
    // Lessons with no teacher, or a teacher whose account was deactivated.
    unstaffed: () => request('/api/timetable/unstaffed/'),
    schoolWeek: {
      get: () => request('/api/timetable/school-week/'),
      update: (days) => request('/api/timetable/school-week/', { method: 'PATCH', body: { days } }),
    },
    periods: {
      list: () => request('/api/timetable/periods/'),
      create: (body) => request('/api/timetable/periods/', { method: 'POST', body }),
      update: (id, body) => request(`/api/timetable/periods/${id}/`, { method: 'PATCH', body }),
      remove: (id) => request(`/api/timetable/periods/${id}/`, { method: 'DELETE' }),
      // {start: "08:00", lesson_minutes, lessons, breaks: [{after, minutes, name}]}
      standard: (body) => request('/api/timetable/periods/standard/', { method: 'POST', body }),
    },
    rooms: {
      list: () => request('/api/timetable/rooms/'),
      create: (body) => request('/api/timetable/rooms/', { method: 'POST', body }),
      remove: (id) => request(`/api/timetable/rooms/${id}/`, { method: 'DELETE' }),
    },
    lessons: {
      create: (body) => request('/api/timetable/lessons/', { method: 'POST', body }),
      update: (id, body) => request(`/api/timetable/lessons/${id}/`, { method: 'PATCH', body }),
      remove: (id) => request(`/api/timetable/lessons/${id}/`, { method: 'DELETE' }),
    },
  },
  // Behaviour (discipline) records. Parents see shared ones through their child's profile.
  discipline: {
    // { student, category, severity, from, to }
    list: (params) => listRequest('/api/discipline/incidents/', { params }),
    // { student, date, category, severity, description, action, action_detail, staff_notes, shared_with_parents }
    create: (body) => request('/api/discipline/incidents/', { method: 'POST', body }),
    update: (id, body) => request(`/api/discipline/incidents/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/discipline/incidents/${id}/`, { method: 'DELETE' }),
    // Merits: rewards. Parents see shared ones (the default) in the app.
    merits: {
      // { student, school_class, category, from, to }
      list: (params) => listRequest('/api/discipline/merits/', { params }),
      summary: (params) => request('/api/discipline/merits/summary/', { params }),
      // { students: [ids], date, category, points, reason, shared_with_parents }
      create: (body) => request('/api/discipline/merits/', { method: 'POST', body }),
      update: (id, body) => request(`/api/discipline/merits/${id}/`, { method: 'PATCH', body }),
      remove: (id) => request(`/api/discipline/merits/${id}/`, { method: 'DELETE' }),
    },
  },
  // The school calendar: events, term dates and fixtures for whoever is signed in.
  calendar: {
    get: (params) => request('/api/calendar/', { params }),
    feed: () => request('/api/calendar/feed/'),
    renewFeed: () => request('/api/calendar/feed/', { method: 'POST' }),
    events: {
      // { title, kind, description, location, start_date, end_date, start_time, end_time, staff_only, year_groups: [ids] }
      create: (body) => request('/api/calendar/events/', { method: 'POST', body }),
      update: (id, body) => request(`/api/calendar/events/${id}/`, { method: 'PATCH', body }),
      remove: (id) => request(`/api/calendar/events/${id}/`, { method: 'DELETE' }),
    },
  },
  // The school's subscription (admins only): status, tier, invoices and how to pay.
  billing: {
    get: () => request('/api/billing/'),
    // { method, reference, note }: tells HouseMaster the school has paid; it's checked and recorded by hand.
    reportPaid: (id, body) => request(`/api/billing/invoices/${id}/paid/`, { method: 'POST', body }),
    invoicePdf: (id) => downloadFile(`/api/billing/invoices/${id}/pdf/`),
  },
  // Absences parents have reported (staff), and whether parents get same-day absence alerts.
  absenceReports: {
    // { date, school_class, unseen, from }
    list: (params) => request('/api/absence-reports/', { params }),
    seen: (id) => request(`/api/absence-reports/${id}/seen/`, { method: 'POST' }),
    settings: () => request('/api/absences/settings/'),
    setAlerts: (on) => request('/api/absences/settings/', { method: 'PATCH', body: { alerts_enabled: on } }),
  },
  // Homework: teachers set it and record how each student did.
  homework: {
    // { school_class, subject, mine, when: upcoming|past }
    list: (params) => listRequest('/api/homework/', { params }),
    choices: () => request('/api/homework/choices/'),
    // { school_class, subject, title, instructions, link, due_date, out_of }
    create: (body) => request('/api/homework/', { method: 'POST', body }),
    update: (id, body) => request(`/api/homework/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/homework/${id}/`, { method: 'DELETE' }),
    records: (id) => request(`/api/homework/${id}/records/`),
    // { records: [{ student, status, mark, comment }] }
    saveRecords: (id, body) => request(`/api/homework/${id}/records/`, { method: 'POST', body }),
  },
  // Clubs and activities. Every staff member sees them; a club's staff run it.
  clubs: {
    list: (params) => listRequest('/api/clubs/', { params }),
    // { name, kind, description, meets, location, is_active, leaders: [user ids] }
    create: (body) => request('/api/clubs/', { method: 'POST', body }),
    update: (id, body) => request(`/api/clubs/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/clubs/${id}/`, { method: 'DELETE' }),
    staff: () => request('/api/clubs/staff/'),
    members: (id) => request(`/api/clubs/${id}/members/`),
    // { students: [ids], role }
    addMembers: (id, body) => request(`/api/clubs/${id}/members/`, { method: 'POST', body }),
    updateMember: (id, studentId, body) => request(`/api/clubs/${id}/members/${studentId}/`, { method: 'PATCH', body }),
    removeMember: (id, studentId) => request(`/api/clubs/${id}/members/${studentId}/`, { method: 'DELETE' }),
    candidates: (id, q) => request(`/api/clubs/${id}/candidates/`, { params: { q } }),
    register: (id, date) => request(`/api/clubs/${id}/register/`, { params: { date } }),
    // { date, note, marks: [{ student, status }] }
    saveRegister: (id, body) => request(`/api/clubs/${id}/register/`, { method: 'POST', body }),
    sessions: (id) => request(`/api/clubs/${id}/sessions/`),
  },
  // Fixtures and results. { club, upcoming, results, from, to }
  fixtures: {
    list: (params) => listRequest('/api/fixtures/', { params }),
    create: (body) => request('/api/fixtures/', { method: 'POST', body }),
    update: (id, body) => request(`/api/fixtures/${id}/`, { method: 'PATCH', body }),
    remove: (id) => request(`/api/fixtures/${id}/`, { method: 'DELETE' }),
  },
  // Students who need extra support: HouseMaster suggests, staff confirm.
  support: {
    suggestions: (term) => request('/api/support/suggestions/', { params: term ? { term } : undefined }),
    concerns: {
      list: (params) => listRequest('/api/support/concerns/', { params }),
      // {student, term, reasons: [codes], note, support_plan, review_date}
      create: (body) => request('/api/support/concerns/', { method: 'POST', body }),
      update: (id, body) => request(`/api/support/concerns/${id}/`, { method: 'PATCH', body }),
      resolve: (id, note) => request(`/api/support/concerns/${id}/resolve/`, { method: 'POST', body: { note } }),
      dismiss: (student, term) => request('/api/support/concerns/dismiss/', { method: 'POST', body: { student, term } }),
    },
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
  // Extra roles (Head of Year, Nurse, ...): {profile, role, year_group|subject|school_class}. Admins only.
  staffRoles: {
    list: (params) => request('/api/staff-roles/', { params }),
    create: (body) => request('/api/staff-roles/', { method: 'POST', body }),
    remove: (id) => request(`/api/staff-roles/${id}/`, { method: 'DELETE' }),
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
    // Already paged by the backend; the Activity screen reads `results` itself.
    list: (params) => request('/api/activity/', { params }),
  },

  // Admins see and decide every request; teachers see and cancel their own.
  changeRequests: {
    list: (params) => listRequest('/api/change-requests/', { params }),
    page: (params) => request('/api/change-requests/', { params }),
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

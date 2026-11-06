// The page you're on is in the address bar (/attendance, /students/42), so the browser's back button,
// bookmarks and shared links work. Links that carry a token (/join/…, /reset-password/…) are handled
// before sign-in and are never pages.
const NOT_PAGES = new Set(['invite', 'guardian-invite', 'staff-join', 'join', 'apply', 'reset-password', 'register'])

export function readRoute(path = window.location.pathname) {
  const [tab, id] = path.split('/').filter(Boolean)
  if (!tab || NOT_PAGES.has(tab) || !/^[a-z-]+$/.test(tab)) return null
  const studentId = tab === 'students' && /^\d+$/.test(id || '') ? Number(id) : null
  return { tab, params: studentId ? { studentId } : null }
}

// A sign-up, invite or reset link is open: the address bar belongs to it.
export function onTokenLink(path = window.location.pathname) {
  return NOT_PAGES.has(path.split('/').filter(Boolean)[0])
}

export function pathFor(tab, params) {
  if (!tab || tab === 'home') return '/'
  return tab === 'students' && params?.studentId ? `/students/${params.studentId}` : `/${tab}`
}

// Puts the page in the address bar: a new history entry, or in place of the current one.
export function showRoute(tab, params, replace = false) {
  const path = pathFor(tab, params)
  if (window.location.pathname === path) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
}

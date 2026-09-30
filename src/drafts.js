// Work typed but not yet saved (a register, a mark), kept on the phone so a
// failed save, a closed tab or a phone that kills the app in the background
// doesn't lose it. Kept per signed-in person, so on a shared phone nobody
// sees someone else's draft; deleted on sign-out and after a week. Only what
// the person typed is kept, never data loaded from the server.
const PREFIX = 'housemaster_draft:'
const MAX_AGE_MS = 7 * 24 * 3600 * 1000

const keyFor = (userId, name) => `${PREFIX}${userId}:${name}`

export function saveDraft(userId, name, value) {
  if (userId === undefined || userId === null) return
  try {
    if (value === null || value === undefined) {
      localStorage.removeItem(keyFor(userId, name))
    } else {
      localStorage.setItem(keyFor(userId, name), JSON.stringify({ at: Date.now(), value }))
    }
  } catch {
    // storage full or blocked (private mode): the work stays on screen only
  }
}

export function loadDraft(userId, name) {
  if (userId === undefined || userId === null) return null
  try {
    const raw = localStorage.getItem(keyFor(userId, name))
    if (!raw) return null
    const { at, value } = JSON.parse(raw)
    if (!(Date.now() - at < MAX_AGE_MS)) {
      localStorage.removeItem(keyFor(userId, name))
      return null
    }
    return value
  } catch {
    return null
  }
}

export function clearDrafts() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(PREFIX)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    // nothing stored, or storage unavailable
  }
}

import { useEffect, useState } from 'react'

// Where you are in the app (the page, an open student or conversation, a tab), kept for this browser
// tab so a refresh opens the same place. Forgotten on sign-out, and a page's own details are
// forgotten when you go to another page, so pages still open fresh when you come back to them.
const PREFIX = 'hm.page.'

export function recall(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function keep(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(PREFIX + key)
    else sessionStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // storage unavailable: a refresh just starts from the top
  }
}

export function forget(prefix = '') {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(PREFIX + prefix)) sessionStorage.removeItem(key)
    }
  } catch {
    // storage unavailable
  }
}

// Like useState, but survives a refresh. `override` (e.g. a student a link opened) wins over what was kept.
export function useRemembered(key, fallback, override = null) {
  const [value, setValue] = useState(() => override ?? recall(key, fallback))
  useEffect(() => { keep(key, value) }, [key, value])
  return [value, setValue]
}

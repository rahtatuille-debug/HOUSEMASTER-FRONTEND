import { useEffect, useRef, useState } from 'react'
import { connection } from './connection.js'
import { api } from './api.js'

const BACK_ONLINE_MS = 4000
const RECHECK_MS = 15000

// A strip at the top of every screen when the phone is offline or the
// server can't be reached, so a missing answer never looks like a hang.
// Screens that were already open stay usable; saving waits for the signal.
export default function OfflineBanner({ ping = api.ping }) {
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const [unreachable, setUnreachable] = useState(() => !connection.get().reachable)
  const [backOnline, setBackOnline] = useState(false)
  const wasDown = useRef(offline || unreachable)
  const timer = useRef(null)

  // While the server can't be reached, look again every so often (and as
  // soon as the phone reconnects), so the banner clears by itself.
  const check = useRef(null)
  check.current = async () => {
    if (await ping()) connection.report(true)
  }

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => {
      setOffline(false)
      if (!connection.get().reachable) check.current()
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    const stop = connection.subscribe((s) => setUnreachable(!s.reachable))
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      stop()
    }
  }, [])

  useEffect(() => {
    if (!unreachable || offline) return undefined
    const id = setInterval(() => check.current(), RECHECK_MS)
    return () => clearInterval(id)
  }, [unreachable, offline])

  const down = offline || unreachable
  useEffect(() => {
    if (down) {
      wasDown.current = true
      setBackOnline(false)
      clearTimeout(timer.current)
    } else if (wasDown.current) {
      wasDown.current = false
      setBackOnline(true)
      timer.current = setTimeout(() => setBackOnline(false), BACK_ONLINE_MS)
    }
  }, [down])
  useEffect(() => () => clearTimeout(timer.current), [])

  if (offline) {
    return (
      <div className="connection-banner offline" role="status">
        You’re offline. What’s already on screen stays, but changes can’t be saved until you’re back online.
      </div>
    )
  }
  if (unreachable) {
    return (
      <div className="connection-banner offline" role="status">
        The signal is weak: HouseMaster can’t reach the server right now. It will keep trying.
      </div>
    )
  }
  if (backOnline) {
    return <div className="connection-banner online" role="status">Back online.</div>
  }
  return null
}

import { useEffect, useState } from 'react'
import { api } from '../api.js'

// One login can belong to several schools (staff at one, a parent at another…). Lists them and moves this
// session to another; `memberships` is what /api/me/ already gave, or it's asked for (the paused screen).
export default function SchoolSwitcher({ memberships, onSwitched }) {
  const [list, setList] = useState(memberships || null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (memberships) { setList(memberships); return }
    api.account.memberships().then(setList).catch(() => setList([]))
  }, [memberships])

  const others = (Array.isArray(list) ? list : []).filter((m) => !m.current)
  if (others.length === 0) return null

  async function choose(m) {
    setBusy(m.key)
    setError('')
    try {
      await api.account.switch(m.key)
      onSwitched(m)
    } catch (err) {
      setError(err.message)
      setBusy('')
    }
  }

  return (
    <div className="school-switcher">
      <p className="hint" style={{ margin: '0 0 6px' }}>Switch to</p>
      {others.map((m) => (
        <button key={m.key} type="button" className="secondary" style={{ width: '100%', marginBottom: 8 }}
          disabled={!!busy} onClick={() => choose(m)}>
          {busy === m.key ? 'Switching…' : `${m.school} · ${m.role}`}
        </button>
      ))}
      {error && <p className="error-banner" role="alert">{error}</p>}
    </div>
  )
}

import { useState } from 'react'
import { api } from '../api.js'

// Admins: whether the school has boarders. Turning it on adds the Boarding
// menu (houses, beds, roll calls, leave and sick bay) and the parents' tab.
export default function BoardingOptionCard({ school, me, onSaved }) {
  const [on, setOn] = useState(Boolean(school?.has_boarding))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if (me?.role !== 'admin' || !school) return null

  async function toggle(value) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await api.schools.update(school.id, { has_boarding: value })
      setOn(value)
      setNotice(value ? 'Boarding is on. Open Boarding in the menu to add houses and beds.' : 'Boarding is off.')
      onSaved?.(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Boarding</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        For schools with boarders: houses and beds, evening and night roll calls, leave and exeat, and the sick bay.
        Parents of boarders get a Boarding tab. Turning it off hides all of this; nothing is deleted.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={on} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        Our school has boarders
      </label>
    </div>
  )
}

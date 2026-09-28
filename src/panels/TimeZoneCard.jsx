import { useState } from 'react'
import { api } from '../api.js'

// For browsers without Intl.supportedValuesOf (older Safari): the zones
// HouseMaster schools are likeliest to be in. The school's own zone is
// always added.
const FALLBACK_ZONES = [
  'Africa/Nairobi', 'Africa/Kampala', 'Africa/Dar_es_Salaam', 'Africa/Kigali', 'Africa/Addis_Ababa',
  'Africa/Lagos', 'Africa/Accra', 'Africa/Johannesburg', 'Africa/Cairo',
  'Europe/London', 'Europe/Dublin', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Hong_Kong', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Sao_Paulo',
  'UTC',
]

export function timeZoneOptions(current) {
  let zones = []
  try {
    zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  } catch {
    zones = []
  }
  if (!zones.length) zones = FALLBACK_ZONES
  return current && !zones.includes(current) ? [current, ...zones] : [...zones]
}

// Admins: the school's time zone (F-5). It decides when the school's day
// starts, so "today" for registers, the dashboard and report card dates.
export default function TimeZoneCard({ school, me, onSaved }) {
  const current = school?.timezone || 'Africa/Nairobi'
  const [value, setValue] = useState(current)
  const [saved, setSaved] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if (me?.role !== 'admin' || !school) return null
  const options = timeZoneOptions(saved)

  async function save(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    if (!options.includes(value)) {
      setError('Pick a time zone from the list, for example Africa/Nairobi.')
      return
    }
    setBusy(true)
    try {
      const updated = await api.schools.update(school.id, { timezone: value })
      setSaved(updated?.timezone || value)
      setNotice('Time zone saved.')
      onSaved?.(updated)
    } catch (err) {
      const field = err.data?.timezone
      setError((Array.isArray(field) ? field.join(' ') : field) || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>School time zone</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        This decides when the school's day starts: which day counts as "today" for registers and the dashboard, and
        the dates on report cards. Choose where the school is.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <form onSubmit={save} className="form-actions" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ flex: '1 1 260px', marginBottom: 0 }}>
          <label htmlFor="school-timezone">School time zone</label>
          <input id="school-timezone" list="school-timezone-options" value={value} autoComplete="off"
            placeholder="Type to search, e.g. Nairobi" onChange={(e) => setValue(e.target.value)} />
          <datalist id="school-timezone-options">
            {options.map((zone) => <option key={zone} value={zone} />)}
          </datalist>
        </div>
        <button type="submit" disabled={busy || value === saved}>{busy ? 'Saving…' : 'Save time zone'}</button>
      </form>
    </div>
  )
}

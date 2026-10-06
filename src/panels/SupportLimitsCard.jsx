import { useEffect, useState } from 'react'
import { api } from '../api.js'

const FIELDS = [
  { key: 'support_pass_mark', label: 'Average below (%)', fallback: 40,
    help: 'A student whose average for the term is below this is suggested.' },
  { key: 'support_drop_points', label: 'Average dropped by (points)', fallback: 10,
    help: 'A fall of this many points or more since the last term.' },
  { key: 'support_attendance_min', label: 'Attendance below (%)', fallback: 80,
    help: 'Days attended (present or late) out of days recorded this term.' },
  { key: 'support_min_marks', label: 'Marks needed first', fallback: 3, max: 50,
    help: 'An average counts only once a student has this many marks in the term, so one quiz never flags anyone.' },
  { key: 'support_min_days', label: 'Attendance days needed first', fallback: 10, max: 200,
    help: 'Attendance counts only once this many days are recorded in the term.' },
  { key: 'support_reopen_points', label: 'Bring back a dismissed one after (points)', fallback: 10,
    help: 'A suggestion marked "Not needed" comes back that term if the average or attendance falls this much more.' },
]

// One year group can use a different pass mark (blank: the school's).
function YearPassMarks({ school }) {
  const [years, setYears] = useState([])
  const [values, setValues] = useState({})
  const [message, setMessage] = useState('')
  useEffect(() => {
    api.yearGroups.list().then((list) => {
      const rows = Array.isArray(list) ? list : list?.results || []
      setYears(rows)
      setValues(Object.fromEntries(rows.map((y) => [y.id, y.support_pass_mark ?? ''])))
    }).catch(() => {})
  }, [])
  if (!years.length) return null
  async function save(year) {
    const raw = values[year.id]
    const n = raw === '' ? null : Number(raw)
    if (n === (year.support_pass_mark ?? null)) return
    if (n !== null && (!Number.isInteger(n) || n < 1 || n > 100)) { setMessage('Enter a whole number from 1 to 100, or leave it blank.'); return }
    try {
      await api.yearGroups.update(year.id, { support_pass_mark: n })
      setYears(years.map((y) => (y.id === year.id ? { ...y, support_pass_mark: n } : y)))
      setMessage(`Saved for ${year.name}.`)
    } catch (err) {
      setMessage(err.message)
    }
  }
  return (
    <details style={{ marginTop: 12 }}>
      <summary>A different pass mark for a year group</summary>
      {message && <p className="hint">{message}</p>}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
        {years.map((y) => (
          <div className="field" key={y.id} style={{ flex: '1 1 160px' }}>
            <label htmlFor={`pass-${y.id}`}>Pass mark for {y.name} (%)</label>
            <input id={`pass-${y.id}`} type="number" min="1" max="100" value={values[y.id]}
              placeholder={`School's (${school.support_pass_mark ?? 40})`}
              onChange={(e) => setValues({ ...values, [y.id]: e.target.value })} onBlur={() => save(y)} />
          </div>
        ))}
      </div>
    </details>
  )
}

// Admins: when HouseMaster suggests a student for the Needs support page.
export default function SupportLimitsCard({ school, me, onSaved }) {
  const initial = Object.fromEntries(FIELDS.map((f) => [f.key, String(school?.[f.key] ?? f.fallback)]))
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  if (me?.role !== 'admin' || !school) return null

  async function save(e) {
    e.preventDefault()
    setError('')
    setNotice('')
    const body = {}
    for (const f of FIELDS) {
      const n = Number(values[f.key])
      const max = f.max || 100
      if (!Number.isInteger(n) || n < 1 || n > max) {
        setError(`${f.label}: enter a whole number from 1 to ${max}.`)
        return
      }
      body[f.key] = n
    }
    setBusy(true)
    try {
      const updated = await api.schools.update(school.id, body)
      setNotice('Saved. Suggestions use the new limits straight away.')
      onSaved?.(updated)
    } catch (err) {
      const first = Object.values(err.data || {}).flat().find((v) => typeof v === 'string')
      setError(first || err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Students who need support</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        HouseMaster suggests a student on the Needs support page when any of these is true. A teacher always
        confirms before anything is marked or shared with parents.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <form onSubmit={save} noValidate>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {FIELDS.map((f) => (
            <div className="field" key={f.key} style={{ flex: '1 1 180px' }}>
              <label htmlFor={`limit-${f.key}`}>{f.label}</label>
              <input id={`limit-${f.key}`} type="number" min="1" max={f.max || 100} inputMode="numeric" value={values[f.key]}
                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
              <p className="hint" style={{ margin: '4px 0 0' }}>{f.help}</p>
            </div>
          ))}
        </div>
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : 'Save limits'}</button>
      </form>
      <YearPassMarks school={school} />
    </div>
  )
}

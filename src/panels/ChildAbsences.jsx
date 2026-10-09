import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'

export const ABSENCE_REASONS = [
  ['illness', 'Ill'], ['appointment', 'Medical or dental appointment'], ['family', 'Family reasons'],
  ['religious', 'Religious observance'], ['travel', 'Travel'], ['other', 'Other'],
]

const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
export const daysText = (r) => (r.start_date === r.end_date ? formatDate(r.start_date)
  : `${formatDate(r.start_date, { day: 'numeric', month: 'short' })} to ${formatDate(r.end_date)}`)

// A parent tells the school their child is or will be away; the class's register shows it.
// A student sees what their parents reported, without the form. `startOn` (from an absence
// alert's link) opens the form for that day.
export default function ChildAbsences({ studentId, firstName, readOnly = false, startOn = null }) {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState(startOn && !readOnly ? { start_date: startOn, end_date: startOn, reason: 'illness', details: '' } : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.guardianStudents.absences(studentId).then(setRows).catch((err) => setError(err.message))
  useEffect(() => { load() }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm((f) => {
    const next = { ...f, [key]: e.target.value }
    // Moving the first day past the last moves the last day with it.
    if (key === 'start_date' && (!f.end_date || f.end_date < next.start_date)) next.end_date = next.start_date
    return next
  })

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.guardianStudents.reportAbsence(studentId, form)
      setForm(null)
      setNotice(`Thank you. The school has been told, and it will show on ${firstName}'s register.`)
      load()
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }

  async function cancel(r) {
    setError('')
    try {
      await api.guardianStudents.cancelAbsence(studentId, r.id)
      setNotice('Cancelled.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const d = new Date()
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return (
    <div className="card">
      <div className="support-row">
        <div>
          <h3 style={{ fontSize: 15, margin: 0 }}>Absences</h3>
          {!readOnly && <p className="hint" style={{ margin: '4px 0 0' }}>Tell the school if {firstName} is ill or will be away.</p>}
        </div>
        {!form && !readOnly && (
          <button type="button" style={{ width: 'auto' }} onClick={() => { setNotice(''); setForm({ start_date: today, end_date: today, reason: 'illness', details: '' }) }}>
            Report an absence
          </button>
        )}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {form && (
        <form onSubmit={send} className="tt-form-grid" style={{ marginTop: 10 }} aria-label="Report an absence">
          <label>First day<input type="date" value={form.start_date} onChange={set('start_date')} required /></label>
          <label>Last day<input type="date" value={form.end_date} min={form.start_date} onChange={set('end_date')} required /></label>
          <label>Reason
            <select value={form.reason} onChange={set('reason')}>
              {ABSENCE_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>Anything the school should know (optional)
            <input value={form.details} onChange={set('details')} maxLength={500} placeholder="e.g. back after lunch" />
          </label>
          <div className="tt-form-actions">
            <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Sending…' : 'Tell the school'}</button>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      {rows === null ? <p className="text-muted">Loading…</p> : rows.length === 0 ? (
        <p className="text-muted" style={{ margin: '8px 0 0' }}>None reported.</p>
      ) : (
        <ul className="support-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="support-row">
                <div>
                  <strong>{daysText(r)}</strong> · {r.reason_label}
                  <div className="hint" style={{ margin: 0 }}>
                    {r.cancelled_at ? 'Cancelled' : [`Reported by ${r.reported_by_name}`, r.seen_at ? 'Seen by the school' : ''].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {!readOnly && !r.cancelled_at && r.end_date >= today && (
                  <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => cancel(r)} aria-label={`Cancel the absence on ${daysText(r)}`}>Cancel</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

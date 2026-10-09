import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import { daysText } from './ChildAbsences.jsx'

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// What parents have told the school about absences (for the children whose register this person sees),
// and, for admins, whether parents get an alert when their child is marked absent.
export default function Absences({ me }) {
  const [rows, setRows] = useState(null)
  const [alerts, setAlerts] = useState(null)
  const [error, setError] = useState('')
  const isAdmin = me?.role === 'admin'

  const load = useCallback(() => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    api.absenceReports.list({ from: iso(weekAgo) }).then(setRows).catch((err) => setError(err.message))
  }, [])
  useEffect(() => {
    load()
    api.absenceReports.settings().then((s) => setAlerts(s.alerts_enabled)).catch(() => {})
  }, [load])

  async function seen(r) {
    try {
      const fresh = await api.absenceReports.seen(r.id)
      setRows((list) => list.map((x) => (x.id === r.id ? fresh : x)))
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleAlerts() {
    setError('')
    try {
      setAlerts((await api.absenceReports.setAlerts(!alerts)).alerts_enabled)
    } catch (err) {
      setError(err.message)
    }
  }

  const today = iso(new Date())
  const live = (rows || []).filter((r) => !r.cancelled_at)
  const groups = [
    ['Today', live.filter((r) => r.start_date <= today && r.end_date >= today)],
    ['Coming up', live.filter((r) => r.start_date > today)],
    ['Last week', live.filter((r) => r.end_date < today)],
  ]
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Absences</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>What parents have told the school. They also show on the register for that day.</p>
        </div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}

      {alerts !== null && (
        <div className="card">
          <div className="support-row">
            <div>
              <h3 style={{ fontSize: 15, margin: 0 }}>Absence alerts to parents</h3>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                {alerts
                  ? "On: when a student is marked absent at today's register, their parents get an email (and a phone notification if they've turned those on), unless they already told the school. If the mark is corrected, they get a short correction."
                  : 'Off: parents are not told when their child is marked absent.'}
              </p>
            </div>
            {isAdmin && (
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={toggleAlerts}>
                {alerts ? 'Turn off' : 'Turn on'}
              </button>
            )}
          </div>
        </div>
      )}

      {rows === null ? <p className="text-muted">Loading…</p> : live.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>No absences reported by parents.</p></div>
      ) : groups.filter(([, list]) => list.length).map(([title, list]) => (
        <div className="card" key={title}>
          <h3 style={{ fontSize: 15, marginTop: 0 }}>{title}</h3>
          <ul className="support-list">
            {list.map((r) => (
              <li key={r.id} className={r.seen_at ? '' : 'absence-unseen'}>
                <div className="support-row">
                  <div>
                    <strong>{r.student_name}</strong>{r.class_name && <span className="text-muted"> · {r.class_name}</span>}
                    <div>{daysText(r)} · {r.reason_label}</div>
                    {r.details && <div className="hint" style={{ margin: 0 }}>{r.details}</div>}
                    <div className="hint" style={{ margin: 0 }}>
                      {`From ${r.reported_by_name}, ${formatDateTime(r.created_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`}
                      {r.seen_at && ` · Seen by ${r.seen_by_name}`}
                    </div>
                  </div>
                  {!r.seen_at && (
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => seen(r)} aria-label={`Mark ${r.student_name}'s absence as seen`}>Seen</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

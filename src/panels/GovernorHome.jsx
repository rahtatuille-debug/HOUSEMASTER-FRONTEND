import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import Panel from './Panel.jsx'

// A governor's read-only home: the school's figures, never a named student.
export default function GovernorHome({ me }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.governorSummary().then(setData).catch((err) => setError(err.message)) }, [])
  if (error) return <div className="error-banner">{error}</div>
  if (!data) return <p className="text-muted">Loading…</p>
  const att = data.attendance
  const b = data.behaviour_last_30_days
  return (
    <div className="dashboard">
      <div className="dash-greeting">
        <div>
          <h2>{data.school}</h2>
          <p className="text-muted">School figures · {formatDate(data.date, { weekday: 'long', day: 'numeric', month: 'long' })}. Read-only: no individual students are shown.</p>
        </div>
      </div>
      <div className="stat-row">
        <div className="stat-tile"><div className="stat-label">Students</div><div className="stat-value">{data.students}</div></div>
        <div className="stat-tile"><div className="stat-label">Staff</div><div className="stat-value">{data.staff}</div></div>
        <div className="stat-tile">
          <div className="stat-label">Attendance {att.is_today ? 'today' : `on ${formatDate(att.date, { weekday: 'long' })}`}</div>
          <div className="stat-value">{att.rate != null ? `${att.rate}%` : '—'}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>{att.marked} of {att.students} marked · {att.classes_not_taken} of {att.classes} registers not taken</div>
        </div>
        <div className="stat-tile"><div className="stat-label">Students on a support plan</div><div className="stat-value">{data.support_open}</div></div>
      </div>
      <div className="dash-grid">
        <Panel title="Students by year group">
          {data.students_by_year_group.length === 0 ? <p className="text-muted dash-empty">No year groups yet.</p> : (
            <table className="dash-table">
              <thead><tr><th>Year group</th><th>Girls</th><th>Boys</th><th>Total</th></tr></thead>
              <tbody>{data.students_by_year_group.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.female}</td><td>{r.male}</td><td><strong>{r.total}</strong></td></tr>)}</tbody>
            </table>
          )}
        </Panel>
        <Panel title="Behaviour, last 30 days">
          <table className="dash-table">
            <tbody>
              <tr><td>Minor</td><td>{b.minor}</td></tr>
              <tr><td>Moderate</td><td>{b.moderate}</td></tr>
              <tr><td>Serious</td><td>{b.serious}</td></tr>
            </tbody>
            <tfoot><tr><td>All</td><td><strong>{b.total}</strong></td></tr></tfoot>
          </table>
        </Panel>
        <Panel title="Reports">
          <p style={{ margin: 0 }}><strong>{data.reports_waiting}</strong> report{data.reports_waiting === 1 ? '' : 's'} waiting for approval.</p>
        </Panel>
      </div>
      {me?.name && <p className="hint">Signed in as {me.name} (governor, read-only).</p>}
    </div>
  )
}

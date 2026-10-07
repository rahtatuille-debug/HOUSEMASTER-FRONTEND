import { useEffect, useState } from 'react'
import { useVocab } from '../levels.js'
import { formatDate } from '../format.js'
import { api } from '../api.js'
import FirstWeekChecklist from './FirstWeekChecklist.jsx'
import Panel from './Panel.jsx'
import { Bulletin, Greeting, MyDay, NeedsAttention, QuickFind, SchoolNumbers } from './DashboardParts.jsx'

function StatTile({ label, value, sub, onClick, alert }) {
  const content = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={alert ? { color: 'var(--stamp-red)' } : undefined}>{value}</div>
      {sub && <div className="text-muted" style={{ fontSize: 12 }}>{sub}</div>}
    </>
  )
  return onClick ? (
    <button type="button" className="stat-tile stat-tile-button" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="stat-tile">{content}</div>
  )
}

// Admin dashboard: a few numbers across the top, then panels for the day,
// the bulletin, what is waiting, the school's numbers and a student search.
export default function Home({ me, onNavigate, onStartTour }) {
  const words = useVocab()
  const [data, setData] = useState(null)
  const [lessons, setLessons] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.dashboard().then(setData).catch((err) => setError(err.message))
    // An admin who also teaches sees their own lessons.
    api.teacherHome.get().then((d) => setLessons(d?.today || [])).catch(() => setLessons([]))
  }, [])

  if (error) return <div className="error-banner">{error}</div>
  if (!data) return <p className="text-muted">Loading…</p>

  const att = data.attendance_today
  const waiting = data.reports_waiting.count + data.requests_waiting
  const noParent = data.students_without_parent
  // At weekends the figures are for the last school day.
  const registerDay = att.is_today ? 'today' : `on ${formatDate(att.date, { weekday: 'long' })}`

  const registersTab = (
    att.classes.length === 0 ? (
      <p className="text-muted dash-empty">No classes with students yet.</p>
    ) : (
      <table className="dash-table">
        <thead><tr><th>{words.class}</th><th>Marked</th><th>Absent</th><th>Late</th></tr></thead>
        <tbody>
          {att.classes.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.marked === 0 ? <span className="badge rejected">Not taken</span> : `${c.marked} / ${c.students}`}</td>
              <td>{c.marked ? c.absent : '—'}</td>
              <td>{c.marked ? c.late : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  )

  const expired = data.invites.items.filter((i) => i.status === 'expired').length
  const attention = [
    att.classes_not_taken.length > 0 && {
      key: 'registers', alert: true, action: 'Registers', onClick: () => onNavigate('attendance'),
      text: `${att.classes_not_taken.length} register${att.classes_not_taken.length === 1 ? '' : 's'} not taken ${registerDay}: ${att.classes_not_taken.slice(0, 4).join(', ')}${att.classes_not_taken.length > 4 ? '…' : ''}`,
    },
    data.reports_waiting.count > 0 && {
      key: 'reports', action: 'Review', onClick: () => onNavigate('approvals'),
      text: `${data.reports_waiting.count} report${data.reports_waiting.count === 1 ? '' : 's'} waiting for approval`,
    },
    data.requests_waiting > 0 && {
      key: 'requests', action: 'Review', onClick: () => onNavigate('approvals'),
      text: `${data.requests_waiting} teacher request${data.requests_waiting === 1 ? '' : 's'} to approve`,
    },
    data.parent_signups_waiting > 0 && {
      key: 'signups', action: 'Parents', onClick: () => onNavigate('parents'),
      text: `${data.parent_signups_waiting} parent sign-up${data.parent_signups_waiting === 1 ? '' : 's'} to approve`,
    },
    data.invites.items.length > 0 && {
      key: 'invites', action: 'Staff', onClick: () => onNavigate('staff'),
      text: `${data.invites.items.length} invite${data.invites.items.length === 1 ? '' : 's'} not accepted${expired ? ` (${expired} expired)` : ''}`,
    },
    noParent.count > 0 && {
      key: 'noparent', action: 'Invite parents', onClick: () => onNavigate('parents'),
      text: `${noParent.count} student${noParent.count === 1 ? '' : 's'} with no parent account`,
    },
  ]

  return (
    <div className="dashboard">
      <Greeting me={me} onStartTour={onStartTour} onNavigate={onNavigate} />

      {data.active_alerts.length > 0 && (
        <div className="card urgent-card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Active urgent alerts</h3>
          {data.active_alerts.map((a) => (
            <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, marginBottom: 4 }}>
              <span>{a.title}</span>
              <span className="text-muted">seen by {a.seen} of {a.total}</span>
            </div>
          ))}
          <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => onNavigate('alerts')}>
            Open urgent alerts
          </button>
        </div>
      )}

      <FirstWeekChecklist onNavigate={onNavigate} />

      <div className="stat-row">
        <StatTile
          label={`Attendance ${registerDay}`}
          value={att.rate != null ? `${att.rate}%` : '—'}
          sub={att.marked ? `${att.marked} of ${att.students} students marked` : 'No registers taken yet'}
          onClick={() => onNavigate('attendance')}
        />
        <StatTile
          label={`Absent ${registerDay}`}
          value={att.absent}
          sub={att.classes_not_taken.length ? `${att.classes_not_taken.length} class registers not taken` : 'All registers taken'}
          alert={att.classes_not_taken.length > 0}
          onClick={() => onNavigate('attendance')}
        />
        <StatTile
          label="Waiting for you"
          value={waiting}
          sub={`${data.reports_waiting.count} reports · ${data.requests_waiting} requests`}
          alert={waiting > 0}
          onClick={() => onNavigate('approvals')}
        />
        <StatTile
          label="Students with no parent account"
          value={noParent.count}
          sub={data.parent_signups_waiting
            ? `${data.parent_signups_waiting} parent sign-up${data.parent_signups_waiting === 1 ? '' : 's'} to approve`
            : `of ${noParent.total_students} active students`}
          alert={data.parent_signups_waiting > 0}
          onClick={() => onNavigate('parents')}
        />
      </div>

      <div className="dash-grid">
        <MyDay lessons={lessons} onNavigate={onNavigate} />
        <NeedsAttention items={attention} />
        <Bulletin onNavigate={onNavigate} extraTabs={[['registers', att.is_today ? 'Registers today' : 'Registers', registersTab]]} />
        {data.students_by_year_group && <SchoolNumbers rows={data.students_by_year_group} onNavigate={onNavigate} />}
        <QuickFind onNavigate={onNavigate} />
        {data.reports_waiting.count > 0 && (
          <Panel title="Reports waiting for approval"
            actions={<button type="button" className="secondary" onClick={() => onNavigate('approvals')}>Review</button>}>
            <ul className="dash-list">
              {data.reports_waiting.items.map((r) => (
                <li key={r.id}><span>{r.student} <span className="text-muted">· {r.term}</span></span></li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  )
}

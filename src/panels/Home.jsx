import { useEffect, useState } from 'react'
import { useVocab } from '../levels.js'
import { formatDate } from '../format.js'
import { api } from '../api.js'
import FirstWeekChecklist from './FirstWeekChecklist.jsx'

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

// Admin home page: today's attendance and everything waiting on an admin.
export default function Home({ me, onNavigate, onStartTour }) {
  const words = useVocab()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.dashboard().then(setData).catch((err) => setError(err.message))
  }, [])

  if (error) return <div className="error-banner">{error}</div>
  if (!data) return <p className="text-muted">Loading…</p>

  const att = data.attendance_today
  const waiting = data.reports_waiting.count + data.requests_waiting
  const noParent = data.students_without_parent
  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })
  // At weekends the figures are for the last school day.
  const registerDay = att.is_today ? 'today' : `on ${formatDate(att.date, { weekday: 'long' })}`

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}{me?.name ? `, ${me.name.split(' ')[0]}` : ''}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>{me?.school?.name} · {today}</p>
        </div>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onStartTour}>Take the tour</button>
      </div>

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

      <div className="home-grid">
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 10 }}>{att.is_today ? "Today's registers" : `Registers ${registerDay}`}</h3>
          {att.classes.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>No classes with students yet.</p>
          ) : (
            <table className="responsive-table">
              <thead>
                <tr><th>{words.class}</th><th>Marked</th><th>Absent</th><th>Late</th></tr>
              </thead>
              <tbody>
                {att.classes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>
                      {c.marked === 0 ? (
                        <span className="badge rejected">Not taken</span>
                      ) : (
                        `${c.marked} / ${c.students}`
                      )}
                    </td>
                    <td>{c.marked ? c.absent : '—'}</td>
                    <td>{c.marked ? c.late : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <div className="card">
            <div className="panel-header" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 15 }}>Reports waiting for approval</h3>
              {data.reports_waiting.count > 0 && (
                <button type="button" className="secondary" onClick={() => onNavigate('approvals')}>Review</button>
              )}
            </div>
            {data.reports_waiting.count === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>None waiting.</p>
            ) : (
              data.reports_waiting.items.map((r) => (
                <div key={r.id} style={{ fontSize: 14, marginBottom: 4 }}>
                  {r.student} <span className="text-muted">· {r.term}</span>
                </div>
              ))
            )}
            {data.requests_waiting > 0 && (
              <p className="hint" style={{ marginBottom: 0 }}>
                Plus {data.requests_waiting} teacher request{data.requests_waiting === 1 ? '' : 's'} to approve.
              </p>
            )}
          </div>

          <div className="card">
            <div className="panel-header" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 15 }}>Invites not accepted</h3>
            </div>
            {data.invites.items.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>None.</p>
            ) : (
              <>
                {data.invites.items.map((i) => (
                  <div key={`${i.kind}-${i.id}`} style={{ fontSize: 14, marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span>
                      {i.name} <span className="text-muted">· {i.kind}</span>
                    </span>
                    <span className={`badge ${i.status === 'expired' ? 'draft' : 'pending'}`}>{i.status}</span>
                  </div>
                ))}
                <div className="form-actions" style={{ marginTop: 8 }}>
                  <button type="button" className="secondary" onClick={() => onNavigate('staff')}>Staff invites</button>
                  <button type="button" className="secondary" onClick={() => onNavigate('parents')}>Parent invites</button>
                </div>
              </>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Students with no parent account</h3>
            {noParent.count === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>Every active student has a parent account linked.</p>
            ) : (
              <>
                {noParent.items.map((s) => (
                  <div key={s.id} style={{ fontSize: 14, marginBottom: 4 }}>
                    {s.name} <span className="text-muted">· {s.class_name || 'no class'}</span>
                  </div>
                ))}
                {noParent.count > noParent.items.length && (
                  <p className="hint">and {noParent.count - noParent.items.length} more.</p>
                )}
                <button type="button" className="secondary" style={{ marginTop: 8 }} onClick={() => onNavigate('parents')}>
                  Invite parents
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

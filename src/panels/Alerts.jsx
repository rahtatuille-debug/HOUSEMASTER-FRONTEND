import { useEffect, useState } from 'react'
import { api } from '../api.js'

const AUDIENCES = [
  { key: 'everyone', label: 'Everyone (staff and parents)' },
  { key: 'all_staff', label: 'All staff' },
  { key: 'all_parents', label: 'All parents' },
  { key: 'year_group', label: 'Parents of a year group' },
  { key: 'school_class', label: 'Parents of a class' },
]

// Send urgent alerts and see who has seen them. Admins can alert anyone;
// teachers only the parents of a class they teach (the API enforces this).
export default function Alerts({ me }) {
  const isAdmin = me?.role === 'admin'
  const [alerts, setAlerts] = useState([])
  const [yearGroups, setYearGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: isAdmin ? 'everyone' : 'school_class',
    year_group: '',
    school_class: '',
  })
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [openId, setOpenId] = useState(null)
  const [recipients, setRecipients] = useState([])

  async function load() {
    setError('')
    try {
      const [list, years, cls] = await Promise.all([api.alerts.list(), api.yearGroups.list(), api.schoolClasses.list()])
      setAlerts(list)
      setYearGroups(years)
      setClasses(
        isAdmin ? cls : cls.filter((c) => (me?.assignments || []).some((a) => a.school_class === c.id))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  async function send(e) {
    e.preventDefault()
    const audienceLabel = AUDIENCES.find((a) => a.key === form.audience)?.label.toLowerCase()
    if (!window.confirm(`Send this urgent alert to ${audienceLabel} now? It shows as a red banner until each person confirms they've seen it.`)) return
    setSending(true)
    setError('')
    setNotice('')
    try {
      const alert = await api.alerts.create({
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        year_group: form.audience === 'year_group' ? Number(form.year_group) : null,
        school_class: form.audience === 'school_class' ? Number(form.school_class) : null,
      })
      setNotice(`Urgent alert sent to ${alert.recipient_count} ${alert.recipient_count === 1 ? 'person' : 'people'}.`)
      setForm({ ...form, title: '', body: '' })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  async function toggleRecipients(alert) {
    if (openId === alert.id) {
      setOpenId(null)
      return
    }
    setError('')
    try {
      setRecipients(await api.alerts.recipients(alert.id))
      setOpenId(alert.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function endAlert(alert) {
    if (!window.confirm(`End "${alert.title}"? The banner disappears for everyone, including people who haven't seen it yet.`)) return
    setError('')
    try {
      await api.alerts.end(alert.id)
      setNotice('Alert ended.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  const canManage = (alert) => isAdmin || alert.created_by === me?.id
  const audiences = isAdmin ? AUDIENCES : AUDIENCES.filter((a) => a.key === 'school_class')

  return (
    <div>
      <div className="panel-header">
        <h2>Urgent alerts</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="card urgent-card">
        <h3 style={{ marginBottom: 6, fontSize: 15 }}>Send an urgent alert</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          For emergencies and time-critical news only, like a closure, a lockdown or a delayed trip. It appears
          as a red banner on every screen until each person taps “I've seen this”. For everyday news, use
          Communications.
        </p>
        <form onSubmit={send}>
          <div className="form-row">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="alert-audience">Send to</label>
              <select
                id="alert-audience"
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                {audiences.map((a) => (
                  <option key={a.key} value={a.key}>{a.label}</option>
                ))}
              </select>
            </div>
            {form.audience === 'year_group' && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="alert-year">Year group</label>
                <select id="alert-year" value={form.year_group} onChange={(e) => setForm({ ...form, year_group: e.target.value })} required>
                  <option value="">Select…</option>
                  {yearGroups.map((y) => (
                    <option key={y.id} value={y.id}>{y.name}</option>
                  ))}
                </select>
              </div>
            )}
            {form.audience === 'school_class' && (
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="alert-class">Class</label>
                <select id="alert-class" value={form.school_class} onChange={(e) => setForm({ ...form, school_class: e.target.value })} required>
                  <option value="">Select…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="alert-title">Headline</label>
            <input
              id="alert-title"
              value={form.title}
              maxLength={180}
              placeholder="e.g. School closed today"
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="alert-body">What people need to know</label>
            <textarea
              id="alert-body"
              rows={3}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="danger-solid" disabled={sending}>
            {sending ? 'Sending…' : 'Send urgent alert'}
          </button>
        </form>
      </div>

      <h3 style={{ margin: '24px 0 12px', fontSize: 15 }}>Alerts</h3>
      {alerts.length === 0 ? (
        <p className="text-muted">No urgent alerts yet.</p>
      ) : (
        alerts.map((a) => (
          <div className="card" key={a.id} style={{ borderLeft: `3px solid ${a.is_active ? 'var(--stamp-red)' : 'var(--rule)'}` }}>
            <div className="panel-header" style={{ marginBottom: 6 }}>
              <strong>{a.title}</strong>
              <span className={`badge ${a.is_active ? 'rejected' : 'cancelled'}`}>{a.is_active ? 'Active' : 'Ended'}</span>
            </div>
            <p style={{ margin: '0 0 8px' }}>{a.body}</p>
            <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
              {a.created_by_name} · {a.audience_label} · {new Date(a.created_at).toLocaleString()}
              {a.recipient_count !== null && ` · seen by ${a.acknowledged_count} of ${a.recipient_count}`}
            </p>
            {canManage(a) && (
              <div className="form-actions" style={{ marginTop: 10 }}>
                <button className="secondary" onClick={() => toggleRecipients(a)}>
                  {openId === a.id ? 'Hide' : 'Who has seen it'}
                </button>
                {a.is_active && (
                  <button className="danger" onClick={() => endAlert(a)}>
                    End alert
                  </button>
                )}
              </div>
            )}
            {openId === a.id && (
              <table style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Children</th>
                    <th>Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.name} <span className="text-muted">({r.kind})</span>
                      </td>
                      <td className="text-muted">{r.children.join(', ') || '—'}</td>
                      <td>
                        {r.acknowledged_at ? (
                          <span className="badge approved">{new Date(r.acknowledged_at).toLocaleTimeString()}</span>
                        ) : (
                          <span className="badge rejected">Not yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  )
}

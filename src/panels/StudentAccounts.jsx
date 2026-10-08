import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'

const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
const asList = (d) => (Array.isArray(d) ? d : d?.results || [])
const BATCH = 25

// Slips to print and hand out: username and starting password, shown only this once.
function Slips({ rows, school, onClose }) {
  return (
    <div className="card sa-slips-card">
      <div className="sa-slips-head no-print">
        <div>
          <h3 style={{ fontSize: 15, margin: 0 }}>Sign-in slips ({rows.length})</h3>
          <p className="hint" style={{ margin: '4px 0 0' }}>Print or copy these now: the passwords aren&apos;t shown again. Students choose their own password the first time they sign in.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={{ width: 'auto' }} onClick={() => window.print()}>Print slips</button>
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onClose}>Done</button>
        </div>
      </div>
      <div className="sa-slips print-area">
        {rows.map((r) => (
          <div key={r.student} className="sa-slip">
            <span><strong>{r.name}</strong>{r.class_name && <span className="text-muted"> · {r.class_name}</span>}</span>
            <span>Sign in at <strong>{window.location.host}</strong>{school ? ` (${school})` : ''}</span>
            <span>Username: <code>{r.username}</code></span>
            <span>Password: <code>{r.password}</code></span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Student logins: school-made usernames and starting passwords.
export default function StudentAccounts({ me }) {
  const [rows, setRows] = useState(null)
  const [klass, setKlass] = useState('')
  const [chosen, setChosen] = useState([])
  const [slips, setSlips] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [progress, setProgress] = useState('')

  const load = useCallback(async () => {
    try { setRows(asList(await api.studentAccounts.list())) } catch (err) { setError(err.message) }
  }, [])
  useEffect(() => { load() }, [load])

  const classes = useMemo(() => [...new Map((rows || []).filter((r) => r.school_class).map((r) => [r.school_class, r.class_name])).entries()]
    .sort((a, b) => String(a[1]).localeCompare(String(b[1]), undefined, { numeric: true })), [rows])
  const shown = (rows || []).filter((r) => !klass || String(r.school_class) === klass)
  const without = shown.filter((r) => !r.has_account)

  async function act(fn, message) {
    setError('')
    setNotice('')
    try {
      const result = await fn()
      if (message) setNotice(typeof message === 'function' ? message(result) : message)
      await load()
      return result
    } catch (err) {
      setError(fieldError(err))
      return null
    }
  }
  // Batches of BATCH (each password takes about a second to secure), slips shown as they come.
  async function make(ids) {
    setError('')
    setNotice('')
    const made = []
    let already = 0
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        setProgress(`Making accounts… ${Math.min(i + BATCH, ids.length)} of ${ids.length}`)
        const result = await api.studentAccounts.create(ids.slice(i, i + BATCH))
        made.push(...result.created)
        already += result.already
        setSlips([...made])
      }
      setChosen([])
      setNotice(`Made ${made.length} account${made.length === 1 ? '' : 's'}.${already ? ` ${already} already had one.` : ''}`)
    } catch (err) {
      setError(`${fieldError(err)}${made.length ? ` (${made.length} were made: their slips are below.)` : ''}`)
    } finally {
      setProgress('')
      await load()
    }
  }
  async function reset(r) {
    if (!window.confirm(`Give ${r.name} a new starting password? They'll be signed out and must choose a new password.`)) return
    const result = await act(() => api.studentAccounts.reset(r.student))
    if (result) setSlips([result])
  }
  const toggle = (id) => setChosen(chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])

  return (
    <div>
      <div className="panel-header no-print">
        <div>
          <h2>Student accounts</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Give students their own sign-in. They see their timetable, homework, grades and reports, and hand in homework. Nothing about anyone else.</p>
        </div>
      </div>
      {error && <div className="error-banner no-print" role="alert">{error}</div>}
      {notice && <div className="success-banner no-print" role="status">{notice}</div>}
      {progress && <div className="card no-print" role="status"><p style={{ margin: 0 }}>{progress} This takes about a second per student.</p></div>}
      {slips && slips.length > 0 && <Slips rows={slips} school={me?.school?.name} onClose={() => setSlips(null)} />}

      <div className="card discipline-filters no-print">
        <label>Class
          <select value={klass} onChange={(e) => { setKlass(e.target.value); setChosen([]) }}>
            <option value="">All classes</option>
            {classes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'end', flexWrap: 'wrap' }}>
          {without.length > 0 && <button type="button" className="secondary" style={{ width: 'auto' }} disabled={Boolean(progress)}
            onClick={() => make(without.map((r) => r.student))}>Make accounts for everyone without one ({without.length})</button>}
          {chosen.length > 0 && <button type="button" style={{ width: 'auto' }} disabled={Boolean(progress)} onClick={() => make(chosen)}>Make accounts for {chosen.length} chosen</button>}
        </div>
      </div>

      {rows === null ? <p className="text-muted">Loading…</p> : shown.length === 0 ? <div className="card"><p className="text-muted" style={{ margin: 0 }}>No students.</p></div> : (
        <div className="card table-scroll no-print">
          <table className="dash-table sa-table">
            <thead><tr><th aria-label="Choose" /><th>Student</th><th>Class</th><th>Username</th><th>Status</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.student}>
                  <td>{!r.has_account && <input type="checkbox" aria-label={`Choose ${r.name}`} checked={chosen.includes(r.student)} onChange={() => toggle(r.student)} />}</td>
                  <td>{r.name}</td>
                  <td>{r.class_name || '—'}</td>
                  <td>{r.username ? <code>{r.username}</code> : <span className="text-muted">No account</span>}</td>
                  <td>{!r.has_account ? '' : !r.active ? <span className="badge draft">Turned off</span>
                    : r.must_change_password ? <span className="badge pending">Not signed in yet</span>
                      : <span className="badge finalized">{r.last_login ? `Last in ${formatDateTime(r.last_login, { day: 'numeric', month: 'short' })}` : 'Ready'}</span>}</td>
                  <td className="sa-actions">
                    {r.has_account ? (
                      <>
                        <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => reset(r)} aria-label={`New password for ${r.name}`}>New password</button>
                        <button type="button" className="link-button" style={{ width: 'auto' }} aria-label={`${r.active ? 'Turn off' : 'Turn on'} ${r.name}'s account`}
                          onClick={() => act(() => (r.active ? api.studentAccounts.disable(r.student) : api.studentAccounts.enable(r.student)), `${r.name}'s account is ${r.active ? 'off' : 'on'}.`)}>{r.active ? 'Turn off' : 'Turn on'}</button>
                        <button type="button" className="link-button" style={{ width: 'auto' }} aria-label={`Remove ${r.name}'s account`}
                          onClick={() => window.confirm(`Remove ${r.name}'s account? Their homework and records stay.`) && act(() => api.studentAccounts.remove(r.student), `Removed ${r.name}'s account.`)}>Remove</button>
                      </>
                    ) : (
                      <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => make([r.student])} aria-label={`Make an account for ${r.name}`}>Make account</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

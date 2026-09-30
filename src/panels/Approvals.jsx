import { useEffect, useState } from 'react'
import { formatDateTime } from '../format.js'
import { api } from '../api.js'
import { usePagedList } from '../usePagedList.js'
import ShowMore from './ShowMore.jsx'

const FILTERS = [
  { key: 'pending', label: 'Waiting' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: '', label: 'All' },
]

function formatWhen(value) {
  return value ? formatDateTime(value) : ''
}

// Admins: teachers' requests (student deletions, setup and school-setting
// changes) plus reports waiting to be finalized. Teachers: their own
// requests and what happened to them.
export default function Approvals({ me, onCountsChanged }) {
  const isAdmin = me?.role === 'admin'
  const [filter, setFilter] = useState('pending')
  const [students, setStudents] = useState([])
  const [terms, setTerms] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Which row has its note box open, and for what: { type: 'reject' | 'send-back', id }
  const [noteFor, setNoteFor] = useState(null)
  const [note, setNote] = useState('')
  const [busyId, setBusyId] = useState(null)

  // Both lists come from the server a page at a time (F-4).
  const requestList = usePagedList(
    (page) => api.changeRequests.page({ ...(filter ? { status: filter } : {}), ...page }), [filter, isAdmin])
  const reportList = usePagedList(
    (page) => (isAdmin ? api.reports.page({ status: 'submitted', ...page }) : Promise.resolve([])), [isAdmin])
  const requests = requestList.rows
  const reports = reportList.rows
  const loading = requestList.loading || reportList.loading
  const listError = requestList.error || reportList.error

  function load() {
    return Promise.all([requestList.reload(), reportList.reload()])
  }

  useEffect(() => {
    if (!isAdmin) return
    Promise.all([api.students.list(), api.terms.list()])
      .then(([st, te]) => {
        setStudents(st)
        setTerms(te)
      })
      .catch((err) => setError(err.message))
  }, [isAdmin])

  async function run(id, action, message) {
    setBusyId(id)
    setError('')
    setNotice('')
    try {
      await action()
      setNotice(message)
      setNoteFor(null)
      setNote('')
      await load()
      onCountsChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  function approve(r) {
    if (r.operation === 'delete' && !window.confirm(`${r.summary}? This can't be undone.`)) return
    run(r.id, () => api.changeRequests.approve(r.id), 'Approved and applied.')
  }

  function openNote(type, id) {
    setNoteFor({ type, id })
    setNote('')
  }

  const studentName = (id) => {
    const s = students.find((x) => x.id === id)
    return s ? `${s.first_name} ${s.last_name}` : 'Student'
  }
  const termName = (id) => terms.find((t) => t.id === id)?.name || 'Term'

  return (
    <div>
      <div className="panel-header">
        <h2>{isAdmin ? 'Approvals' : 'My requests'}</h2>
      </div>

      {(error || listError) && <div className="error-banner">{error || listError}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      {!isAdmin && (
        <p className="hint" style={{ marginTop: 0 }}>
          Deleting a student, changing classes, subjects, terms or year groups, and changing school
          settings all need an admin's approval. Your requests and their answers show here.
        </p>
      )}

      {isAdmin && (
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 15 }}>Reports waiting to be finalized</h3>
          {loading ? (
            <p className="text-muted">Loading…</p>
          ) : reports.length === 0 ? (
            <p className="text-muted" style={{ margin: 0 }}>No reports are waiting.</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} style={{ borderTop: '1px solid var(--rule)', padding: '12px 0' }}>
                <div className="panel-header" style={{ marginBottom: 6 }}>
                  <strong>
                    {studentName(r.student)} — {termName(r.term)}
                  </strong>
                  <span className="text-muted" style={{ fontSize: 13 }}>
                    Submitted by {r.submitted_by_name || 'a teacher'} · {formatWhen(r.submitted_at)}
                  </span>
                </div>
                <div className="report-doc" style={{ marginBottom: 10 }}>{r.report_comment || '(no comment)'}</div>
                {noteFor?.type === 'send-back' && noteFor.id === r.id ? (
                  <div className="field">
                    <label htmlFor={`sb-${r.id}`}>What needs changing?</label>
                    <textarea id={`sb-${r.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    <div className="form-actions" style={{ marginTop: 8 }}>
                      <button
                        className="danger"
                        disabled={!note.trim() || busyId === r.id}
                        onClick={() => run(r.id, () => api.reports.sendBack(r.id, note.trim()), 'Sent back to the teacher.')}
                      >
                        Send back
                      </button>
                      <button className="secondary" onClick={() => setNoteFor(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="form-actions">
                    <button
                      disabled={busyId === r.id}
                      onClick={() => run(r.id, () => api.reports.finalize(r.id), 'Report finalized. Parents can now see it.')}
                    >
                      Finalize and release to parents
                    </button>
                    <button className="secondary" onClick={() => openNote('send-back', r.id)}>
                      Send back with a note
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
          <ShowMore shown={reports.length} total={reportList.total} onMore={reportList.loadMore} noun="reports" />
        </div>
      )}

      <div className="card">
        <div className="panel-header" style={{ marginBottom: 10 }}>
          <h3 style={{ fontSize: 15 }}>{isAdmin ? "Teachers' requests" : 'Requests'}</h3>
        </div>
        <div className="filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.key || 'all'}
              type="button"
              className={`secondary${filter === f.key ? ' active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>Nothing here.</p>
        ) : (
          <table className="responsive-table">
            <thead>
              <tr>
                {isAdmin && <th>Asked by</th>}
                <th>Request</th>
                <th>Status</th>
                <th>When</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  {isAdmin && <td>{r.requested_by_name}</td>}
                  <td>
                    {r.summary}
                    {r.kind === 'student' && r.data && 'medical_notes' in r.data && (
                      <div style={{ marginTop: 6 }}>
                        <div className="text-muted" style={{ fontSize: 13 }}>Suggested health notes:</div>
                        {r.data.medical_notes
                          ? <div className="health-box">{r.data.medical_notes}</div>
                          : <div className="text-muted" style={{ fontSize: 13 }}>(clear the health notes)</div>}
                      </div>
                    )}
                    {r.reason && <div className="text-muted" style={{ fontSize: 13 }}>Reason: {r.reason}</div>}
                    {r.review_note && (
                      <div className="text-muted" style={{ fontSize: 13 }}>
                        {r.reviewed_by_name ? `${r.reviewed_by_name}: ` : 'Note: '}
                        {r.review_note}
                      </div>
                    )}
                    {noteFor?.type === 'reject' && noteFor.id === r.id && (
                      <div className="field" style={{ marginTop: 8 }}>
                        <label htmlFor={`rj-${r.id}`}>Reason for rejecting (optional)</label>
                        <input id={`rj-${r.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
                        <div className="form-actions" style={{ marginTop: 8 }}>
                          <button
                            className="danger"
                            disabled={busyId === r.id}
                            onClick={() => run(r.id, () => api.changeRequests.reject(r.id, note.trim()), 'Request rejected.')}
                          >
                            Reject
                          </button>
                          <button className="secondary" onClick={() => setNoteFor(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.status}`}>{r.status_label}</span>
                  </td>
                  <td className="text-muted">{formatWhen(r.created_at)}</td>
                  <td>
                    {r.status === 'pending' && isAdmin && !(noteFor?.type === 'reject' && noteFor.id === r.id) && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button disabled={busyId === r.id} onClick={() => approve(r)}>Approve</button>
                        <button className="secondary" onClick={() => openNote('reject', r.id)}>Reject</button>
                      </div>
                    )}
                    {r.status === 'pending' && !isAdmin && r.requested_by === me?.id && (
                      <button
                        className="secondary"
                        disabled={busyId === r.id}
                        onClick={() => run(r.id, () => api.changeRequests.cancel(r.id), 'Request cancelled.')}
                      >
                        Cancel request
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ShowMore shown={requests.length} total={requestList.total} onMore={requestList.loadMore} noun="requests" />
      </div>
    </div>
  )
}

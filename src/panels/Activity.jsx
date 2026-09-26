import { useEffect, useState } from 'react'
import { api } from '../api.js'

// Each option matches one or more action prefixes in the activity log.
const CATEGORIES = [
  { key: '', label: 'Everything' },
  { key: 'staff,staff_invite,assignment,password', label: 'Staff and access' },
  { key: 'parent,parent_invite', label: 'Parents' },
  { key: 'student', label: 'Students' },
  { key: 'grade', label: 'Grades' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'report', label: 'Reports' },
  { key: 'school,year_group,school_class,subject,term', label: 'Setup and settings' },
  { key: 'change_request', label: 'Approval requests' },
  { key: 'announcement', label: 'Announcements' },
]

// Admin-only record of who did what and when.
export default function Activity() {
  const [category, setCategory] = useState('')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [entries, setEntries] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(pageToLoad) {
    setLoading(true)
    setError('')
    try {
      const params = { page: pageToLoad }
      if (category) params.category = category
      if (since) params.since = since
      if (until) params.until = until
      const data = await api.activity.list(params)
      setEntries((current) => (pageToLoad === 1 ? data.results : [...current, ...data.results]))
      setHasMore(Boolean(data.next))
      setPage(pageToLoad)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, since, until])

  return (
    <div>
      <div className="panel-header">
        <h2>Activity log</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="form-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="act-category">Show</label>
            <select id="act-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.label} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="act-since">From</label>
            <input id="act-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="act-until">To</label>
            <input id="act-until" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
        </div>
      </div>

      {entries.length === 0 && !loading ? (
        <div className="empty-state">
          <h3>Nothing recorded</h3>
          <p>Try a different filter or date range.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What happened</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id}>
                <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td>{e.actor_name}</td>
                <td>{e.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {loading && <p className="text-muted">Loading…</p>}
      {hasMore && !loading && (
        <div className="form-actions" style={{ marginTop: 14 }}>
          <button className="secondary" onClick={() => load(page + 1)}>
            Show older
          </button>
        </div>
      )}
    </div>
  )
}

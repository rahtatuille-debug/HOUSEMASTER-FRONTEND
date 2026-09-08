import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function GuardianInvites() {
  const [invites, setInvites] = useState([])
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedStudentIds, setSelectedStudentIds] = useState([])
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [inviteData, studentData] = await Promise.all([
        api.guardianInvites.list(),
        api.students.list({ is_active: true }),
      ])
      setInvites(inviteData)
      setStudents(studentData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function toggleStudent(id) {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    )
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (selectedStudentIds.length === 0) {
      setError('Select at least one student.')
      return
    }
    setCreating(true)
    try {
      await api.guardianInvites.create({
        name: name.trim(),
        email: email.trim(),
        students: selectedStudentIds,
      })
      setName('')
      setEmail('')
      setSelectedStudentIds([])
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id) {
    try {
      await api.guardianInvites.remove(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function inviteLink(token) {
    return `${window.location.origin}/guardian-invite/${token}`
  }

  async function copyLink(invite) {
    try {
      await navigator.clipboard.writeText(inviteLink(invite.token))
      setCopiedId(invite.id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      setError('Could not copy — your browser may be blocking clipboard access.')
    }
  }

  return (
    <div>
      <div className="panel-header">
        <h2>Parents</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Invite a parent/guardian</h3>
        <form onSubmit={handleCreate}>
          <div className="form-row">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="guardian-invite-name">Full name</label>
              <input
                id="guardian-invite-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Grace Otieno"
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="guardian-invite-email">Email</label>
              <input
                id="guardian-invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="grace@example.com"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Student(s)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
              {students.length === 0 && (
                <p className="text-muted" style={{ margin: 0 }}>
                  No active students yet — add one under Students first.
                </p>
              )}
              {students.map((s) => (
                <label
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    border: '1px solid var(--rule)',
                    borderRadius: 6,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={() => toggleStudent(s.id)}
                  />
                  {s.first_name} {s.last_name}
                </label>
              ))}
            </div>
          </div>

          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Generate invite link'}
          </button>
        </form>
        <p className="hint">
          The link is single-use and expires in 7 days. Share it directly with the parent/guardian
          — HouseMaster doesn't send it for you yet.
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : invites.length === 0 ? (
        <div className="empty-state">
          <h3>No parent invites yet</h3>
          <p>Create one above to give a parent access to messaging.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Student(s)</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.name || '—'}</td>
                <td>{inv.email}</td>
                <td>{inv.student_names?.join(', ') || '—'}</td>
                <td>
                  <span
                    className={`badge ${
                      inv.status === 'accepted' ? 'finalized' : inv.status === 'expired' ? 'draft' : 'reviewed'
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="text-muted">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  {inv.status === 'pending' && (
                    <>
                      <button className="secondary" onClick={() => copyLink(inv)}>
                        {copiedId === inv.id ? 'Copied!' : 'Copy link'}
                      </button>
                      <button className="danger" onClick={() => revoke(inv.id)}>
                        Revoke
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

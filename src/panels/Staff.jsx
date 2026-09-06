import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Staff() {
  const [invites, setInvites] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState('teacher')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creating, setCreating] = useState(false)
  const [copiedId, setCopiedId] = useState(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.invites.list()
      setInvites(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    setError('')
    try {
      await api.invites.create({ role, name: name.trim(), email: email.trim() })
      setName('')
      setEmail('')
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function revoke(id) {
    try {
      await api.invites.remove(id)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function inviteLink(token) {
    return `${window.location.origin}/invite/${token}`
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
        <h2>Staff</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Invite a new staff member</h3>
        <form onSubmit={handleCreate} className="form-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="invite-role">Role</label>
            <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="invite-name">Full name</label>
            <input
              id="invite-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Wanjiru"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="invite-email">Email</label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.org"
              required
            />
          </div>
          <button type="submit" disabled={creating}>
            {creating ? 'Creating…' : 'Generate invite link'}
          </button>
        </form>
        <p className="hint">
          The link is single-use and expires in 7 days. This is the email they'll sign in with —
          share the link directly with them; HouseMaster doesn't send it for you yet.
        </p>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : invites.length === 0 ? (
        <div className="empty-state">
          <h3>No invites yet</h3>
          <p>Create one above to bring on a teacher or admin.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Email</th>
              <th>Status</th>
              <th>Invited by</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.name || '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{inv.role}</td>
                <td>{inv.email || '—'}</td>
                <td>
                  <span
                    className={`badge ${
                      inv.status === 'accepted' ? 'finalized' : inv.status === 'expired' ? 'draft' : 'reviewed'
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td>{inv.invited_by_email || '—'}</td>
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

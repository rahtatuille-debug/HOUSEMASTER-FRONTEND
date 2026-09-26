import { Fragment, useEffect, useState } from 'react'
import { api } from '../api.js'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Never'
}

export default function GuardianInvites() {
  const [parents, setParents] = useState([])
  const [editingParentId, setEditingParentId] = useState(null)
  const [editChildren, setEditChildren] = useState([])
  const [notice, setNotice] = useState('')
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
      const [inviteData, studentData, parentData] = await Promise.all([
        api.guardianInvites.list(),
        api.students.list(),
        api.parents.list(),
      ])
      setInvites(inviteData)
      setStudents(studentData)
      setParents(parentData)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const activeStudents = students.filter((s) => s.is_active)

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

  async function run(action, successMessage) {
    setError('')
    setNotice('')
    try {
      await action()
      if (successMessage) setNotice(successMessage)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function startEditingChildren(parent) {
    setEditingParentId(parent.id)
    setEditChildren(parent.students)
  }

  function saveChildren(parent) {
    run(async () => {
      await api.parents.setStudents(parent.id, editChildren)
      setEditingParentId(null)
    }, `${parent.name}'s children were updated.`)
  }

  function sendReset(parent) {
    if (!window.confirm(`Email ${parent.name} a link to choose a new password?`)) return
    run(() => api.parents.sendPasswordReset(parent.id), `A password reset link was emailed to ${parent.name}.`)
  }

  function renewInvite(invite) {
    run(() => api.guardianInvites.renew(invite.id), `New link ready for ${invite.name}. Copy it and send it to them — the old link no longer works.`)
  }

  function toggleActive(parent) {
    if (parent.is_active) {
      if (!window.confirm(`Deactivate ${parent.name}? They will be signed out and unable to log in until reactivated.`)) return
      run(() => api.parents.deactivate(parent.id), `${parent.name}'s account is deactivated.`)
    } else {
      run(() => api.parents.reactivate(parent.id), `${parent.name}'s account is active again.`)
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
      {notice && <div className="success-banner">{notice}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Parents with an account</h3>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : parents.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>No parent has accepted an invite yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Children</th>
                <th>Status</th>
                <th>Last login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {parents.map((p) => {
                const editing = editingParentId === p.id
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td>{p.name}</td>
                      <td>{p.email || '—'}</td>
                      <td>{p.student_names.length ? p.student_names.join(', ') : <span className="text-muted">None</span>}</td>
                      <td>
                        <span className={`badge ${p.is_active ? 'active' : 'inactive'}`}>
                          {p.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="text-muted">{formatDate(p.last_login)}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button className="secondary" onClick={() => (editing ? setEditingParentId(null) : startEditingChildren(p))}>
                          {editing ? 'Cancel' : 'Children'}
                        </button>
                        {p.is_active && (
                          <button className="secondary" onClick={() => sendReset(p)}>
                            Reset password
                          </button>
                        )}
                        <button className={p.is_active ? 'danger' : 'secondary'} onClick={() => toggleActive(p)}>
                          {p.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      </td>
                    </tr>
                    {editing && (
                      <tr>
                        <td colSpan={6} style={{ background: 'var(--paper)' }}>
                          <p className="hint" style={{ marginTop: 0 }}>
                            {p.name} can see grades, finalized reports and announcements for the children ticked here.
                          </p>
                          <div className="checkbox-list">
                            {students.filter((s) => s.is_active || editChildren.includes(s.id)).map((s) => (
                              <label key={s.id}>
                                <input
                                  type="checkbox"
                                  checked={editChildren.includes(s.id)}
                                  onChange={() =>
                                    setEditChildren((current) =>
                                      current.includes(s.id) ? current.filter((id) => id !== s.id) : [...current, s.id]
                                    )
                                  }
                                />
                                {s.first_name} {s.last_name}
                                {!s.is_active && <span className="text-muted"> (inactive)</span>}
                              </label>
                            ))}
                          </div>
                          <div className="form-actions" style={{ marginTop: 10 }}>
                            <button onClick={() => saveChildren(p)}>Save children</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

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
              {activeStudents.length === 0 && (
                <p className="text-muted" style={{ margin: 0 }}>
                  No active students yet — add one under Students first.
                </p>
              )}
              {activeStudents.map((s) => (
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

      <h3 style={{ margin: '24px 0 12px', fontSize: 15 }}>Invites</h3>
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
                      inv.status === 'accepted' ? 'finalized' : inv.status === 'expired' ? 'draft' : 'pending'
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td className="text-muted">{new Date(inv.created_at).toLocaleDateString()}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  {inv.status === 'pending' && (
                    <button className="secondary" onClick={() => copyLink(inv)}>
                      {copiedId === inv.id ? 'Copied!' : 'Copy link'}
                    </button>
                  )}
                  {inv.status !== 'accepted' && (
                    <button className="secondary" onClick={() => renewInvite(inv)}>
                      {inv.status === 'expired' ? 'Renew link' : 'New link'}
                    </button>
                  )}
                  {inv.status === 'pending' && (
                    <button className="danger" onClick={() => revoke(inv.id)}>
                      Revoke
                    </button>
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

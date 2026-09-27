import { Fragment, useEffect, useState } from 'react'
import StaffImportCard from './StaffImportCard.jsx'
import { api } from '../api.js'
import { displayRole, personIdentity } from '../user.js'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Never'
}

export default function Staff({ me }) {
  const [members, setMembers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [openMemberId, setOpenMemberId] = useState(null)
  const [newClass, setNewClass] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [notice, setNotice] = useState('')
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
      const [inv, staff, assigned, cls, subj] = await Promise.all([
        api.invites.list(),
        api.staff.list(),
        api.teachingAssignments.list(),
        api.schoolClasses.list(),
        api.subjects.list(),
      ])
      setInvites(inv)
      setMembers(staff)
      setAssignments(assigned)
      setClasses(cls)
      setSubjects(subj)
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

  function changeRole(member, role) {
    if (role === member.role) return
    const what = role === 'admin' ? 'give admin rights to' : 'remove admin rights from'
    if (!window.confirm(`Are you sure you want to ${what} ${member.name}?`)) return
    run(() => api.staff.setRole(member.id, role), `${member.name} is now ${displayRole(role).toLowerCase()}.`)
  }

  function toggleActive(member) {
    if (member.is_active) {
      if (!window.confirm(`Deactivate ${member.name}? They will be signed out and unable to log in until reactivated. Nothing they did is deleted.`)) return
      run(() => api.staff.deactivate(member.id), `${member.name}'s account is deactivated.`)
    } else {
      run(() => api.staff.reactivate(member.id), `${member.name}'s account is active again.`)
    }
  }

  function sendReset(member) {
    if (!window.confirm(`Email ${member.name} a link to choose a new password?`)) return
    run(() => api.staff.sendPasswordReset(member.id), `A password reset link was emailed to ${member.name}.`)
  }

  async function renewInvite(invite) {
    await run(() => api.invites.renew(invite.id), `New link ready for ${invite.name}. Copy it and send it to them — the old link no longer works.`)
  }

  function addAssignment(e, member) {
    e.preventDefault()
    if (!newClass || !newSubject) return
    run(async () => {
      await api.teachingAssignments.create({
        teacher: member.id,
        school_class: Number(newClass),
        // No subject means every subject in the class.
        subject: newSubject === 'all' ? null : Number(newSubject),
      })
      setNewSubject('')
    })
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
      {notice && <div className="success-banner">{notice}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 6, fontSize: 15 }}>Staff members</h3>
        <p className="hint" style={{ marginTop: 0, marginBottom: 14 }}>
          Teachers only see the students in the classes they're assigned to, and can only enter
          grades for the subjects they teach there. Admins see everything.
        </p>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Teaches</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Last login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isMe = m.user_id === me?.id
                const own = assignments.filter((a) => a.teacher === m.id)
                const open = openMemberId === m.id
                return (
                  <Fragment key={m.id}>
                    <tr>
                      <td>
                        {m.name}
                        {isMe && <span className="text-muted"> (you)</span>}
                      </td>
                      <td>{m.email || '—'}</td>
                      <td>
                        {isMe ? (
                          displayRole(m.role)
                        ) : (
                          <select
                            value={m.role}
                            aria-label={`Role for ${m.name}`}
                            onChange={(e) => changeRole(m, e.target.value)}
                            disabled={!m.is_active}
                          >
                            <option value="teacher">Teacher</option>
                            <option value="admin">Admin</option>
                          </select>
                        )}
                      </td>
                      <td>
                        {own.length === 0 ? (
                          <span className="text-muted">{m.role === 'admin' ? 'All classes' : 'Nothing yet'}</span>
                        ) : (
                          own.map((a) => `${a.class_name} ${a.subject_name}`).join(', ')
                        )}
                      </td>
                      <td>
                        <span className={`badge ${m.is_active ? 'active' : 'inactive'}`}>
                          {m.is_active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="text-muted">{formatDate(m.date_joined)}</td>
                      <td className="text-muted">{formatDate(m.last_login)}</td>
                      <td style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="secondary"
                          onClick={() => {
                            setOpenMemberId(open ? null : m.id)
                            setNewClass('')
                            setNewSubject('')
                          }}
                        >
                          {open ? 'Done' : 'Classes'}
                        </button>
                        {!isMe && m.is_active && (
                          <button className="secondary" onClick={() => sendReset(m)}>
                            Reset password
                          </button>
                        )}
                        {!isMe && (
                          <button className={m.is_active ? 'danger' : 'secondary'} onClick={() => toggleActive(m)}>
                            {m.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{ background: 'var(--paper)' }}>
                          <div className="chip-list" style={{ marginBottom: 10 }}>
                            {own.length === 0 && <span className="text-muted">Not assigned to any classes yet.</span>}
                            {own.map((a) => (
                              <span className="chip" key={a.id}>
                                {a.class_name} · {a.subject_name}
                                <button
                                  type="button"
                                  className="secondary"
                                  aria-label={`Remove ${a.class_name} ${a.subject_name}`}
                                  onClick={() => run(() => api.teachingAssignments.remove(a.id))}
                                >
                                  ✕
                                </button>
                              </span>
                            ))}
                          </div>
                          {classes.length === 0 || subjects.length === 0 ? (
                            <p className="hint" style={{ margin: 0 }}>Add classes and subjects in Setup first.</p>
                          ) : (
                            <form onSubmit={(e) => addAssignment(e, m)} className="form-row">
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label htmlFor={`as-class-${m.id}`}>Class</label>
                                <select id={`as-class-${m.id}`} value={newClass} onChange={(e) => setNewClass(e.target.value)} required>
                                  <option value="">Select…</option>
                                  {classes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label htmlFor={`as-subject-${m.id}`}>Subject</label>
                                <select id={`as-subject-${m.id}`} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required>
                                  <option value="">Select…</option>
                                  <option value="all">All subjects (class teacher)</option>
                                  {subjects.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </div>
                              <button type="submit">Assign</button>
                            </form>
                          )}
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
              minLength="2"
              maxLength="255"
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="invite-email">Email address</label>
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

      <StaffImportCard onImported={load} />

      <h3 style={{ margin: '24px 0 12px', fontSize: 15 }}>Invites</h3>
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
                <td>{displayRole(inv.role)}</td>
                <td>{inv.email || '—'}</td>
                <td>
                  <span
                    className={`badge ${
                      inv.status === 'accepted' ? 'finalized' : inv.status === 'expired' ? 'draft' : 'pending'
                    }`}
                  >
                    {inv.status}
                  </span>
                </td>
                <td>{inv.invited_by_name ? personIdentity({ name: inv.invited_by_name, role: inv.invited_by_role }) : 'School staff'}</td>
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

import { Fragment, useEffect, useState } from 'react'
import { useVocab } from '../levels.js'
import { formatDate as localDate } from '../format.js'
import StaffImportCard from './StaffImportCard.jsx'
import { api } from '../api.js'
import { displayRole, personIdentity } from '../user.js'
import { ROLE_OPTIONS } from '../permissions.js'

function formatDate(value) {
  return value ? localDate(value) : 'Never'
}

export default function Staff({ me }) {
  const words = useVocab()
  const [members, setMembers] = useState([])
  const [assignments, setAssignments] = useState([])
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [yearGroups, setYearGroups] = useState([])
  const [newRole, setNewRole] = useState('')
  const [newScope, setNewScope] = useState('')
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
      const [inv, staff, assigned, cls, subj, years] = await Promise.all([
        api.invites.list(),
        api.staff.list(),
        api.teachingAssignments.list(),
        api.schoolClasses.list(),
        api.subjects.list(),
        api.yearGroups.list().catch(() => []),
      ])
      setYearGroups(Array.isArray(years) ? years : [])
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
      setNotice(`Emailed ${name.trim()} an invite to ${email.trim()}.`)
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

  // successMessage may be a function of the server's answer.
  async function run(action, successMessage) {
    setError('')
    setNotice('')
    try {
      const result = await action()
      const message = typeof successMessage === 'function' ? successMessage(result) : successMessage
      if (message) setNotice(message)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  function changeRole(member, role) {
    if (role === member.role) return
    const what = role === 'admin' ? 'give admin rights to'
      : role === 'governor' ? 'make a read-only governor account (school figures only) for'
        : 'remove admin rights from'
    if (!window.confirm(`Are you sure you want to ${what} ${member.name}?`)) return
    run(() => api.staff.setRole(member.id, role), `${member.name} is now ${displayRole(role).toLowerCase()}.`)
  }

  function toggleActive(member) {
    if (member.is_active) {
      if (!window.confirm(`Deactivate ${member.name}? They will be signed out and unable to log in until reactivated. Nothing they did is deleted.`)) return
      // Their lessons stay on the timetable with their name; the Timetable page lists them as unstaffed.
      run(() => api.staff.deactivate(member.id), (result) => {
        const n = result?.lessons?.length || 0
        return `${member.name}'s account is deactivated.${n ? ` ${n} lesson${n === 1 ? '' : 's'} on the timetable now have no teacher: see Unstaffed lessons on the Timetable page.` : ''}`
      })
    } else {
      run(() => api.staff.reactivate(member.id), `${member.name}'s account is active again.`)
    }
  }

  function sendReset(member) {
    if (!window.confirm(`Email ${member.name} a link to choose a new password?`)) return
    run(() => api.staff.sendPasswordReset(member.id), `A password reset link was emailed to ${member.name}.`)
  }

  async function renewInvite(invite) {
    await run(() => api.invites.renew(invite.id), `Emailed ${invite.name} a new link. The old link no longer works.`)
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

  const scopeOf = (key) => ROLE_OPTIONS.find(([k]) => k === key)?.[2] || null
  const scopeChoices = { year_group: yearGroups, subject: subjects, school_class: classes }
  const scopeLabels = { year_group: words.year_group || 'Year group', subject: words.subject, school_class: words.class }

  function addRole(e, member) {
    e.preventDefault()
    if (!newRole) return
    const scope = scopeOf(newRole)
    const label = ROLE_OPTIONS.find(([k]) => k === newRole)?.[1]
    run(async () => {
      await api.staffRoles.create({ profile: member.id, role: newRole, ...(scope ? { [scope]: Number(newScope) } : {}) })
      setNewRole('')
      setNewScope('')
    }, `${member.name} is now ${label}.`)
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
          grades for the subjects they teach there. Admins see everything. Roles widen what someone sees:
          Leadership sees the whole school; a Head of Year their year group; a Class Teacher their class;
          a Head of Department their subject; the Nurse, Secretary and Admissions Officer every student&apos;s
          record. A Governor account is read-only and sees school figures only.
        </p>
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : (
          <div className="table-scroll">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Teaches</th>
                <th>Roles</th>
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
                            <option value="governor">Governor (read-only)</option>
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
                        {(m.roles || []).length === 0 ? <span className="text-muted">—</span>
                          : m.roles.map((r) => (r.scope_name ? `${r.role_label} (${r.scope_name})` : r.role_label)).join(', ')}
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
                            setNewRole('')
                            setNewScope('')
                          }}
                          aria-label={`Classes and roles for ${m.name}`}
                        >
                          {open ? 'Done' : 'Classes & roles'}
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
                        <td colSpan={9} style={{ background: 'var(--paper)' }}>
                          <h4 className="staff-sub">Teaches</h4>
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
                                <label htmlFor={`as-class-${m.id}`}>{words.class}</label>
                                <select id={`as-class-${m.id}`} value={newClass} onChange={(e) => setNewClass(e.target.value)} required>
                                  <option value="">Select…</option>
                                  {classes.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="field" style={{ marginBottom: 0 }}>
                                <label htmlFor={`as-subject-${m.id}`}>{words.subject}</label>
                                <select id={`as-subject-${m.id}`} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} required>
                                  <option value="">Select…</option>
                                  <option value="all">All {words.subjects.toLowerCase()} ({words.class.toLowerCase()} teacher)</option>
                                  {subjects.filter((s) => {
                                    // Only the chosen class's curriculum.
                                    const klass = classes.find((c) => c.id === Number(newClass))
                                    return !klass || !s.section || s.section === klass.section
                                  }).map((s) => (
                                    <option key={s.id} value={s.id}>{s.label || s.name}</option>
                                  ))}
                                </select>
                              </div>
                              <button type="submit">Assign</button>
                            </form>
                          )}
                          <h4 className="staff-sub">Roles</h4>
                          {m.role === 'governor' ? (
                            <p className="hint" style={{ margin: 0 }}>Governor accounts are read-only and can&apos;t hold roles.</p>
                          ) : (
                            <>
                              <div className="chip-list" style={{ marginBottom: 10 }}>
                                {(m.roles || []).length === 0 && <span className="text-muted">No extra roles.</span>}
                                {(m.roles || []).map((r) => (
                                  <span className="chip" key={r.id}>
                                    {r.scope_name ? `${r.role_label} · ${r.scope_name}` : r.role_label}
                                    <button type="button" className="secondary" aria-label={`Remove ${r.role_label}${r.scope_name ? ` ${r.scope_name}` : ''} from ${m.name}`}
                                      onClick={() => run(() => api.staffRoles.remove(r.id), `Removed ${r.role_label} from ${m.name}.`)}>✕</button>
                                  </span>
                                ))}
                              </div>
                              <form onSubmit={(e) => addRole(e, m)} className="form-row">
                                <div className="field" style={{ marginBottom: 0 }}>
                                  <label htmlFor={`role-${m.id}`}>Role</label>
                                  <select id={`role-${m.id}`} value={newRole} onChange={(e) => { setNewRole(e.target.value); setNewScope('') }} required>
                                    <option value="">Select…</option>
                                    {ROLE_OPTIONS.filter(([k]) => !(k === 'leadership' && m.role === 'admin')).map(([k, label]) => (
                                      <option key={k} value={k}>{label}</option>
                                    ))}
                                  </select>
                                </div>
                                {scopeOf(newRole) && (
                                  <div className="field" style={{ marginBottom: 0 }}>
                                    <label htmlFor={`role-scope-${m.id}`}>{scopeLabels[scopeOf(newRole)]}</label>
                                    <select id={`role-scope-${m.id}`} value={newScope} onChange={(e) => setNewScope(e.target.value)} required>
                                      <option value="">Select…</option>
                                      {(scopeChoices[scopeOf(newRole)] || []).map((x) => <option key={x.id} value={x.id}>{x.label || x.name}</option>)}
                                    </select>
                                  </div>
                                )}
                                <button type="submit">Add role</button>
                              </form>
                            </>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          </div>
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
              <option value="governor">Governor (read-only)</option>
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
            {creating ? 'Inviting…' : 'Send invite'}
          </button>
        </form>
        <p className="hint">
          HouseMaster emails them a link to create their account. It works once and expires in 7 days, and
          this is the email they'll sign in with. You can also copy the link below to send it another way.
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
        <table className="responsive-table">
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
                <td className="text-muted">{formatDate(inv.created_at)}</td>
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

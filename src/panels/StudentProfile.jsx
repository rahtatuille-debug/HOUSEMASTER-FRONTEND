import { useEffect, useRef, useState } from 'react'
import TermSummary from './TermSummary.jsx'
import { formatDate as localDate, formatDateTime } from '../format.js'
import DataProtection from './DataProtection.jsx'
import { ScaleContext, useWithLevel, useVocab } from '../levels.js'
import { api, needsApproval } from '../api.js'
import { ContactDetails, RELATIONSHIPS } from './ParentContact.jsx'
import PerformanceChart from './PerformanceChart.jsx'
import { BarChart, COMPARE } from './charts.jsx'

const SECTIONS = [
  { key: 'details', label: 'Student details' },
  { key: 'performance', label: 'Performance trends' },
  { key: 'academics', label: 'Grades' },
  { key: 'subjects', label: 'Subjects & teachers' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'parents', label: 'Parents' },
  { key: 'reports', label: 'Reports' },
  { key: 'history', label: 'History', adminOnly: true },
  { key: 'privacy', label: 'Data protection', adminOnly: true },
]

const GENDERS = { female: 'Female', male: 'Male', other: 'Other' }
const MODES = { day: 'Day', boarding: 'Boarding' }
const REPORT_STATUS = { draft: 'Draft', submitted: 'Waiting for approval', finalized: 'Finalized' }

function formatDate(value) {
  return value ? localDate(String(value).slice(0, 10)) : '—'
}

function editableFields(student) {
  return {
    first_name: student.first_name,
    last_name: student.last_name,
    external_id: student.external_id || '',
    school_class: student.school_class ? String(student.school_class) : '',
    house: student.house || '',
    gender: student.gender || '',
    date_of_birth: student.date_of_birth || '',
    nationality: student.nationality || '',
    mode_of_learning: student.mode_of_learning || '',
    enrolled_on: student.enrolled_on || '',
    medical_notes: student.medical_notes || '',
  }
}

// Each subject in the chosen term against the class average.
function SubjectBreakdown({ studentId, name }) {
  const words = useVocab()
  const [data, setData] = useState(null)
  const [term, setTerm] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api.performance({ scope: 'student', id: studentId, term }).then(setData).catch((err) => setError(err.message))
  }, [studentId, term])
  if (error) return <div className="error-banner">{error}</div>
  if (!data || !data.terms.length) return null
  const bars = [{ key: 'student', label: name, color: COMPARE[0] }, { key: 'class', label: 'Class average', color: COMPARE[1] }]
  const rows = data.subjects.filter((x) => x.student != null).map((x) => ({ label: x.subject, student: x.student, class: x.class }))
  return (
    <div className="card">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 15 }}>{words.subjects}</h3>
        <select aria-label="Term" value={term || data.term} onChange={(e) => setTerm(e.target.value)} style={{ width: 'auto' }}>
          {data.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>Each subject against the class average.</p>
      <BarChart rows={rows} bars={bars} label={`${name} by subject`} />
    </div>
  )
}

// One term's results in the school's system (levels, KCSE points and
// positions, GPA or IB grades), with the subject teachers' comments.
function TermResults({ studentId, terms }) {
  const words = useVocab()
  const [term, setTerm] = useState(terms[0]?.term_id || '')
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!term) return
    setError('')
    api.students.termSummary(studentId, term).then(setSummary).catch((err) => setError(err.message))
  }, [studentId, term])
  return (
    <div className="card">
      <div className="panel-header" style={{ marginBottom: 10 }}>
        <h3 style={{ fontSize: 15 }}>{words.term} results</h3>
        <select aria-label={words.term} value={term} onChange={(e) => setTerm(e.target.value)} style={{ width: 'auto' }}>
          {terms.map((t) => <option key={t.term_id} value={t.term_id}>{t.term}</option>)}
        </select>
      </div>
      {error ? <div className="error-banner">{error}</div> : <TermSummary summary={summary} />}
    </div>
  )
}

// Everything about one student, opened from the Students list.
export default function StudentProfile({ studentId, me, onBack }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [section, setSection] = useState('details')
  const [profile, setProfile] = useState(null)
  // Levels on the student's own grading (their section's, in a school running two curricula).
  const fmt = useWithLevel(profile?.student?.scale)
  const [classes, setClasses] = useState([])
  const [photoUrl, setPhotoUrl] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  async function load() {
    setError('')
    try {
      const [data, cls] = await Promise.all([api.students.profile(studentId), api.schoolClasses.list()])
      setProfile(data)
      setClasses(cls)
      return data
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  async function loadPhoto(hasPhoto) {
    setPhotoUrl((old) => {
      if (old) URL.revokeObjectURL(old)
      return null
    })
    if (hasPhoto) setPhotoUrl(await api.students.photoUrl(studentId))
  }

  useEffect(() => {
    load().then((data) => data && loadPhoto(data.student.has_photo))
    return () => setPhotoUrl((old) => (old && URL.revokeObjectURL(old), null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId])

  if (!profile) {
    return (
      <div>
        <button type="button" className="secondary" onClick={onBack}>← Back to students</button>
        {error ? <div className="error-banner" style={{ marginTop: 16 }}>{error}</div> : <p className="text-muted">Loading…</p>}
      </div>
    )
  }

  const s = profile.student
  const name = `${s.first_name} ${s.last_name}`
  // Teachers can only put students in classes they teach.
  const classOptions = isAdmin
    ? classes
    : classes.filter((c) => (me?.assignments || []).some((a) => a.school_class === c.id))

  async function run(action, message) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await action()
      if (message) setNotice(typeof message === 'function' ? message(result) : message)
      const data = await load()
      return { result, data }
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setBusy(false)
    }
  }

  async function saveDetails(e) {
    e.preventDefault()
    const body = {
      ...form,
      school_class: form.school_class ? Number(form.school_class) : null,
      date_of_birth: form.date_of_birth || null,
      enrolled_on: form.enrolled_on || null,
    }
    const done = await run(() => api.students.update(s.id, body), 'Details saved.')
    if (done) setEditing(false)
  }

  async function onPhotoChosen(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const done = await run(() => api.students.uploadPhoto(s.id, file), 'Photo updated.')
    if (done) loadPhoto(true)
  }

  async function removePhoto() {
    if (!window.confirm(`Remove ${name}'s photo?`)) return
    const done = await run(() => api.students.removePhoto(s.id), 'Photo removed.')
    if (done) loadPhoto(false)
  }

  function toggleActive() {
    run(() => api.students.update(s.id, { is_active: !s.is_active }), s.is_active ? `${name} was deactivated.` : `${name} is active again.`)
  }

  async function removeStudent() {
    let reason
    if (isAdmin) {
      if (!window.confirm(`Permanently delete ${name}? This also deletes all their grades, attendance and reports, and can't be undone. To keep their history, deactivate them instead.`)) return
    } else {
      reason = window.prompt(`Ask an admin to permanently delete ${name}? You can add a reason (optional).`, '')
      if (reason === null) return
    }
    setError('')
    try {
      const result = await api.students.remove(s.id, reason?.trim())
      if (needsApproval(result)) {
        setNotice(`Sent to an admin for approval to delete ${name}.`)
      } else {
        onBack(`${name} was deleted.`)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const initials = `${s.first_name[0] || ''}${s.last_name[0] || ''}`.toUpperCase()
  const att = profile.attendance
  const latest = profile.performance[profile.performance.length - 1]
  const sections = SECTIONS.filter((x) => !x.adminOnly || isAdmin)

  return (
    <ScaleContext.Provider value={s.scale || null}>
    <div>
      <div className="panel-header">
        <button type="button" className="secondary" onClick={() => onBack()}>← Back to students</button>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setForm(editableFields(s)); setEditing(true); setSection('details') }} disabled={busy}>
            Edit details
          </button>
          <button className="secondary" onClick={toggleActive} disabled={busy}>
            {s.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
          <button className="danger" onClick={removeStudent} disabled={busy}>
            {isAdmin ? 'Delete' : 'Request delete'}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="profile-layout">
        <nav className="profile-nav" aria-label="Student profile sections">
          {sections.map((x) => (
            <button key={x.key} className={section === x.key ? 'active' : ''} onClick={() => setSection(x.key)}>
              {x.label}
            </button>
          ))}
        </nav>

        <div>
          {section === 'details' && (
            <>
              <div className="card">
                <div className="profile-head">
                  <div style={{ textAlign: 'center' }}>
                    {photoUrl ? (
                      <img className="profile-photo" src={photoUrl} alt={`Photo of ${name}`} />
                    ) : (
                      <div className="profile-photo" aria-label="No photo">{initials}</div>
                    )}
                    <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhotoChosen} />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 10 }}>
                      <button type="button" className="secondary" onClick={() => fileInput.current?.click()} disabled={busy}>
                        {s.has_photo ? 'Change photo' : 'Add photo'}
                      </button>
                      {s.has_photo && (
                        <button type="button" className="secondary" onClick={removePhoto} disabled={busy} aria-label="Remove photo">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <h2>{name}</h2>
                    <ul className="fact-list">
                      <li>
                        <span>{words.student_id}</span> <strong>{s.external_id || '—'}</strong>{' '}
                        <span className={`badge ${s.is_active ? 'active' : 'inactive'}`} style={{ minWidth: 0 }}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </li>
                      <li><span>{words.class}</span> {profile.class_name ? `${profile.year_group_name} · ${profile.class_name}` : 'Not in a class'}</li>
                      <li><span>House</span> {s.house || '—'}</li>
                      <li><span>Gender</span> {GENDERS[s.gender] || '—'}</li>
                      <li><span>Date of birth</span> {formatDate(s.date_of_birth)}{profile.age !== null && ` (age ${profile.age})`}</li>
                      <li><span>Nationality</span> {s.nationality || '—'}</li>
                      <li><span>Mode of learning</span> {MODES[s.mode_of_learning] || '—'}</li>
                      <li><span>Admission date</span> {formatDate(s.enrolled_on)}</li>
                      <li><span>Unique ID</span> <span className="mono" style={{ minWidth: 0, color: 'var(--ink)' }}>{s.id}</span></li>
                    </ul>
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, marginBottom: 8 }}>Health notes</h3>
                    {s.medical_notes ? (
                      <div className="health-box">{s.medical_notes}</div>
                    ) : (
                      <p className="text-muted" style={{ marginTop: 0 }}>None recorded.</p>
                    )}
                    <h3 style={{ fontSize: 15, margin: '18px 0 8px' }}>Parents</h3>
                    {profile.parents.length === 0 ? (
                      <p className="text-muted" style={{ margin: 0 }}>No parent account yet.</p>
                    ) : (
                      profile.parents.map((p) => (
                        <div key={p.user_id} style={{ fontSize: 14, marginBottom: 4 }}>
                          {p.name}
                          {p.relationship && <span className="text-muted"> ({RELATIONSHIPS[p.relationship]})</span>}
                          {' · '}
                          {p.phone ? <a href={`tel:${p.phone.replace(/[^+\d]/g, '')}`}>{p.phone}</a> : <span className="text-muted">{p.email}</span>}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="stat-row">
                <div className="stat-tile">
                  <div className="stat-label">Latest term average</div>
                  <div className="stat-value">{fmt(latest?.student, 1)}</div>
                  {latest && <div className="text-muted" style={{ fontSize: 12 }}>{latest.term}{latest.class != null && ` · class ${latest.class}%`}</div>}
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Attendance</div>
                  <div className="stat-value">{att.overall.rate != null ? `${att.overall.rate}%` : '—'}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>Present or late, of {att.overall.total} days recorded</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Days absent</div>
                  <div className="stat-value">{att.overall.absent}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>{att.overall.late} late · {att.overall.excused} excused</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-label">Reports</div>
                  <div className="stat-value">{profile.reports.length}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {profile.reports.filter((r) => r.status === 'finalized').length} finalized
                  </div>
                </div>
              </div>

              {editing && form && (
                <div className="card">
                  <h3 style={{ marginBottom: 14, fontSize: 15 }}>Edit details</h3>
                  <form onSubmit={saveDetails}>
                    <div className="form-row">
                      {[
                        ['first_name', 'First name', 'text', true],
                        ['last_name', 'Last name', 'text', true],
                        ['external_id', words.student_id, 'text'],
                        ['house', 'House', 'text'],
                        ['nationality', 'Nationality', 'text'],
                        ['date_of_birth', 'Date of birth', 'date'],
                        ['enrolled_on', 'Admission date', 'date'],
                      ].map(([key, label, type, required]) => (
                        <div className="field" style={{ marginBottom: 0 }} key={key}>
                          <label htmlFor={`sp-${key}`}>{label}</label>
                          <input id={`sp-${key}`} type={type} value={form[key]} required={required}
                            onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                        </div>
                      ))}
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="sp-class">{words.class}</label>
                        <select id="sp-class" value={form.school_class} onChange={(e) => setForm({ ...form, school_class: e.target.value })} required={!isAdmin}>
                          <option value="">{isAdmin ? 'Not in a class' : 'Select…'}</option>
                          {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          {s.school_class && !classOptions.some((c) => c.id === s.school_class) && (
                            <option value={s.school_class}>{profile.class_name}</option>
                          )}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="sp-gender">Gender</label>
                        <select id="sp-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                          <option value="">Not recorded</option>
                          {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label htmlFor="sp-mode">Mode of learning</label>
                        <select id="sp-mode" value={form.mode_of_learning} onChange={(e) => setForm({ ...form, mode_of_learning: e.target.value })}>
                          <option value="">Not recorded</option>
                          {Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="field" style={{ marginTop: 12 }}>
                      <label htmlFor="sp-health">Health notes</label>
                      <textarea id="sp-health" rows={3} value={form.medical_notes}
                        placeholder="Allergies, conditions or medication staff should know about"
                        onChange={(e) => setForm({ ...form, medical_notes: e.target.value })} />
                    </div>
                    <div className="form-actions">
                      <button type="submit" disabled={busy}>Save details</button>
                      <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {section === 'performance' && (
            <div className="card">
              <h3 style={{ marginBottom: 4, fontSize: 15 }}>Average score by term</h3>
              <p className="hint" style={{ marginTop: 0 }}>
                {name}'s average across all subjects, next to the average for their class and year group.
              </p>
              <PerformanceChart data={profile.performance} />
            </div>
          )}
          {section === 'performance' && <SubjectBreakdown studentId={s.id} name={name} />}

          {section === 'academics' && (
            profile.grades_by_term.length === 0 ? (
              <div className="card"><p className="text-muted" style={{ margin: 0 }}>No grades recorded yet.</p></div>
            ) : (
              [<TermResults key="summary" studentId={s.id} terms={[...profile.grades_by_term].reverse()} />,
              ...[...profile.grades_by_term].reverse().map((t) => (
                <div className="card" key={t.term_id}>
                  <div className="panel-header" style={{ marginBottom: 10 }}>
                    <h3 style={{ fontSize: 15 }}>{t.term}</h3>
                    <span className="text-muted">Average {fmt(t.average, 1)}</span>
                  </div>
                  <table className="responsive-table">
                    <thead><tr><th>{words.subject}</th>{t.grades.some((g) => g.assessment) && <th>Assessment</th>}<th>Score</th><th>Percent</th></tr></thead>
                    <tbody>
                      {t.grades.map((g, i) => (
                        <tr key={i}>
                          <td>{g.subject}</td>
                          {t.grades.some((x) => x.assessment) && <td className="text-muted">{g.assessment || '—'}</td>}
                          <td>{Number(g.score)} / {Number(g.max_score)}</td>
                          <td>{fmt(g.percent)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))]
            )
          )}

          {section === 'subjects' && (
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Teachers for {profile.class_name || 'this student'}</h3>
              {profile.teachers.length === 0 ? (
                <p className="text-muted">No teachers assigned to this class yet.</p>
              ) : (
                <table>
                  <thead><tr><th>{words.subject}</th><th>Teacher</th></tr></thead>
                  <tbody>
                    {profile.teachers.map((t, i) => (
                      <tr key={i}><td>{t.subject}</td><td>{t.teacher}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>{words.subjects}</h3>
              {profile.subjects.length === 0 ? (
                <p className="text-muted" style={{ margin: 0 }}>None yet.</p>
              ) : (
                <div className="chip-list">
                  {profile.subjects.map((x) => <span className="chip" style={{ paddingRight: 10 }} key={x}>{x}</span>)}
                </div>
              )}
            </div>
          )}

          {section === 'attendance' && (
            <div className="card">
              <div className="stat-row">
                {[['Attendance', att.overall.rate != null ? `${att.overall.rate}%` : '—'], ['Present', att.overall.present],
                  ['Absent', att.overall.absent], ['Late', att.overall.late], ['Excused', att.overall.excused]].map(([label, value]) => (
                  <div className="stat-tile" key={label}>
                    <div className="stat-label">{label}</div>
                    <div className="stat-value">{value}</div>
                  </div>
                ))}
              </div>
              {att.current_term && (
                <p className="hint" style={{ marginTop: 0 }}>
                  This term ({att.current_term.term}): {att.current_term.rate != null ? `${att.current_term.rate}% attendance` : 'nothing recorded yet'}, {att.current_term.absent} absent.
                </p>
              )}
              <h3 style={{ margin: '8px 0 10px', fontSize: 15 }}>Latest records</h3>
              {att.recent.length === 0 ? (
                <p className="text-muted" style={{ margin: 0 }}>No attendance recorded yet.</p>
              ) : (
                <table>
                  <thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
                  <tbody>
                    {att.recent.map((r) => (
                      <tr key={r.date}>
                        <td>{formatDate(r.date)}</td>
                        <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                        <td className="text-muted">{r.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {section === 'parents' && (
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Parents with an account</h3>
              {profile.parents.length === 0 ? (
                <p className="text-muted">None yet.{isAdmin && ' Invite one from the Parents screen.'}</p>
              ) : (
                profile.parents.map((p) => (
                  <div key={p.user_id} className="parent-contact">
                    <div className="parent-contact-head">
                      <strong>{p.name}</strong>
                      <span className={`badge ${p.is_active ? 'active' : 'inactive'}`}>{p.is_active ? 'Active' : 'Deactivated'}</span>
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        Last login {p.last_login ? formatDate(p.last_login) : 'never'}
                      </span>
                    </div>
                    <ContactDetails parent={p} />
                  </div>
                ))
              )}
              {profile.pending_parent_invites.length > 0 && (
                <>
                  <h3 style={{ margin: '18px 0 8px', fontSize: 15 }}>Invites not yet accepted</h3>
                  {profile.pending_parent_invites.map((inv, i) => (
                    <div key={i} style={{ fontSize: 14, marginBottom: 4 }}>
                      {inv.name} <span className="text-muted">· {inv.email} · {inv.status}</span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {section === 'reports' && (
            profile.reports.length === 0 ? (
              <div className="card"><p className="text-muted" style={{ margin: 0 }}>No reports yet. Generate one from the Reports screen.</p></div>
            ) : (
              profile.reports.map((r) => (
                <div className="card" key={r.id}>
                  <div className="panel-header" style={{ marginBottom: 8 }}>
                    <h3 style={{ fontSize: 15 }}>{r.term}</h3>
                    <span className={`badge ${r.status}`}>{REPORT_STATUS[r.status] || r.status}</span>
                  </div>
                  <div className="report-doc">{r.report_comment || '(no comment)'}</div>
                </div>
              ))
            )
          )}

          {section === 'privacy' && isAdmin && <DataProtection student={s} onRemoved={() => onBack()} />}

          {section === 'history' && isAdmin && (
            <div className="card">
              <h3 style={{ marginBottom: 12, fontSize: 15 }}>Changes to this student's record</h3>
              {!profile.activity || profile.activity.length === 0 ? (
                <p className="text-muted" style={{ margin: 0 }}>Nothing recorded yet.</p>
              ) : (
                <table className="responsive-table">
                  <thead><tr><th>When</th><th>Who</th><th>What happened</th></tr></thead>
                  <tbody>
                    {profile.activity.map((a, i) => (
                      <tr key={i}>
                        <td className="text-muted" style={{ whiteSpace: 'nowrap' }}>{formatDateTime(a.created_at)}</td>
                        <td>{a.actor_name}</td>
                        <td>{a.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="hint">Grade and attendance changes for this student are in the Activity log.</p>
            </div>
          )}
        </div>
      </div>
    </div>
    </ScaleContext.Provider>
  )
}

import { useEffect, useState } from 'react'
import { FixtureLine } from './Clubs.jsx'
import HomeworkList from './HomeworkList.jsx'
import TermSummary from './TermSummary.jsx'
import { formatDate as localDate, formatDateTime } from '../format.js'
import { useSchool, useWithLevel, useVocab } from '../levels.js'
import { api } from '../api.js'
import PerformanceChart from './PerformanceChart.jsx'
import HealthNotesCard from './HealthNotesCard.jsx'
import SupportCard from './SupportCard.jsx'
import WeekGrid from './WeekGrid.jsx'

const GENDERS = { female: 'Female', male: 'Male', other: 'Other' }
const MODES = { day: 'Day', boarding: 'Boarding' }
const TABS = ['overview', 'progress', 'grades', 'homework', 'timetable', 'attendance', 'reports', 'behaviour', 'clubs']

function formatDate(value) {
  return value ? localDate(value) : '—'
}

function percentage(grade) {
  const score = Number(grade.score)
  const maximum = Number(grade.max_score)
  return Number.isFinite(score) && Number.isFinite(maximum) && maximum > 0 ? (score / maximum) * 100 : null
}

// A finalized report's results, in the school's system.
function ReportResults({ studentId, term }) {
  const [summary, setSummary] = useState(null)
  useEffect(() => {
    api.guardianStudents.termSummary(studentId, term).then(setSummary).catch(() => setSummary(null))
  }, [studentId, term])
  return summary ? <div className="report-results"><TermSummary summary={summary} /></div> : null
}

export default function GuardianStudents() {
  const school = useSchool()
  const words = useVocab()
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  // Levels on the child's own grading (their section's, in a school running two curricula).
  const fmt = useWithLevel(selected?.scale)
  const [tab, setTab] = useState('overview')
  const [grades, setGrades] = useState([])
  const [reports, setReports] = useState([])
  const [profile, setProfile] = useState(null)
  const [photoUrl, setPhotoUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadStudents() {
    setLoading(true)
    setError('')
    try {
      setStudents(await api.guardianStudents.list())
    } catch (err) {
      setError(err.status === 403 ? 'You do not have access to student records.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadStudents() }, [])

  async function downloadCard(report) {
    setError('')
    try {
      await api.guardianStudents.reportCard(selected.id, report.term)
    } catch (err) {
      setError(err.message)
    }
  }

  async function openStudent(id) {
    setDetailLoading(true)
    setError('')
    try {
      const [studentProfile, studentGrades, studentReports] = await Promise.all([
        api.guardianStudents.profile(id),
        api.guardianStudents.grades(id),
        api.guardianStudents.reports(id),
      ])
      setSelected(studentProfile.student)
      setProfile(studentProfile)
      setGrades(studentGrades)
      setReports(studentReports)
      setPhotoUrl((old) => (old && URL.revokeObjectURL(old), null))
      if (studentProfile.student.has_photo) setPhotoUrl(await api.guardianStudents.photoUrl(id))
      setTab('overview')
    } catch (err) {
      setError(err.status === 404 ? 'This student is unavailable.' : err.message)
    } finally {
      setDetailLoading(false)
    }
  }

  if (selected) {
    return (
      <section>
        <div className="panel-header">
          <button type="button" className="back-button" onClick={() => { setSelected(null); setError('') }}>← Students</button>
        </div>
        {error && <div className="error-banner">{error}</div>}
        <article className="card guardian-student-detail">
          <p className="eyebrow">Student progress</p>
          <h2>{selected.first_name} {selected.last_name}</h2>
          <p className="text-muted">{selected.school_class_name || 'Class not assigned'}{selected.house ? ` · Sports house: ${selected.house}` : ''}</p>
          {profile?.support && <div style={{ margin: '12px 0' }}><SupportCard concern={profile.support} forParents /></div>}
          <div className="guardian-subtabs" role="tablist" aria-label="Student information">
            {[...TABS, ...(school?.has_boarding && selected.mode_of_learning === 'boarding' ? ['boarding'] : [])].map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'active-filter' : 'secondary'} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}
          </div>
          {tab === 'overview' && profile && (
            <>
              <div className="card">
                <div className="profile-head">
                  {photoUrl ? (
                    <img className="profile-photo" src={photoUrl} alt={`Photo of ${selected.first_name}`} />
                  ) : (
                    <div className="profile-photo" aria-label="No photo">{`${selected.first_name[0] || ''}${selected.last_name[0] || ''}`}</div>
                  )}
                  <ul className="fact-list">
                    <li><span>{words.class}</span> {selected.school_class_name || '—'}</li>
                    <li><span>{words.student_id}</span> {selected.external_id || '—'}</li>
                    <li><span>Sports house</span> {selected.house || '—'}</li>
                    <li><span>Date of birth</span> {formatDate(selected.date_of_birth)}{profile.age != null && ` (age ${profile.age})`}</li>
                    <li><span>Gender</span> {GENDERS[selected.gender] || '—'}</li>
                    <li><span>Mode of learning</span> {MODES[selected.mode_of_learning] || '—'}</li>
                    <li><span>Admission date</span> {formatDate(selected.enrolled_on)}</li>
                  </ul>
                  <HealthNotesCard
                    studentId={selected.id}
                    notes={selected.medical_notes}
                    request={profile.health_notes_request}
                    onRequestChange={(r) => setProfile((p) => ({ ...p, health_notes_request: r }))}
                  />
                </div>
              </div>
              <div className="card">
                <h3 style={{ fontSize: 15, marginBottom: 10 }}>Teachers</h3>
                {profile.teachers.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>Not listed yet.</p> : (
                  <table className="responsive-table"><thead><tr><th>{words.subject}</th><th>Teacher</th></tr></thead>
                    <tbody>{profile.teachers.map((t, i) => <tr key={i}><td>{t.subject}</td><td>{t.teacher}</td></tr>)}</tbody></table>
                )}
              </div>
            </>
          )}
          {tab === 'progress' && profile && (
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>Average score by term</h3>
              <p className="hint" style={{ marginTop: 0 }}>{selected.first_name}'s average across all subjects each term.</p>
              <PerformanceChart data={profile.performance} />
              {profile.performance.some((p) => p.student != null) && (
                <table style={{ marginTop: 12 }}>
                  <thead><tr><th>{words.term}</th><th>Average</th></tr></thead>
                  <tbody>{profile.performance.map((p) => <tr key={p.term}><td>{p.term}</td><td>{fmt(p.student, 1)}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          )}
          {tab === 'timetable' && <ChildTimetable studentId={selected.id} />}
          {tab === 'behaviour' && <ChildBehaviour rows={profile?.discipline} merits={profile?.merits} firstName={selected.first_name} />}
          {tab === 'clubs' && <ChildClubs clubs={profile?.clubs} firstName={selected.first_name} />}
          {tab === 'homework' && <HomeworkList items={profile ? (profile.homework || []) : null} firstName={selected.first_name} />}
          {tab === 'boarding' && <ChildBoarding studentId={selected.id} firstName={selected.first_name} />}
          {tab === 'attendance' && profile && (
            <div className="card">
              <div className="stat-row">
                {[['Attendance', profile.attendance.overall.rate != null ? `${profile.attendance.overall.rate}%` : '—'],
                  ['Present', profile.attendance.overall.present], ['Absent', profile.attendance.overall.absent],
                  ['Late', profile.attendance.overall.late], ['Excused', profile.attendance.overall.excused]].map(([label, value]) => (
                  <div className="stat-tile" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>
                ))}
              </div>
              {profile.attendance.recent.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No attendance recorded yet.</p> : (
                <table><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
                  <tbody>{profile.attendance.recent.map((r) => (
                    <tr key={r.date}><td>{formatDate(r.date)}</td><td><span className={`badge ${r.status}`}>{r.status}</span></td><td className="text-muted">{r.notes || '—'}</td></tr>
                  ))}</tbody></table>
              )}
            </div>
          )}
          {tab === 'grades' && (grades.length ? <div className="table-wrap"><table className="responsive-table"><thead><tr><th>{words.subject}</th><th>{words.term}</th><th>Score</th><th>Result</th><th>Recorded</th></tr></thead><tbody>{grades.map((grade) => <tr key={grade.id}><td>{grade.subject_name}</td><td>{grade.term_name}</td><td>{grade.score} / {grade.max_score}</td><td>{fmt(percentage(grade))}</td><td>{formatDate(grade.recorded_at)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No grades have been recorded yet.</h3></div>)}
          {tab === 'reports' && (reports.length ? <div className="guardian-reports">{reports.map((report) => <article className="report-doc" key={report.id}><p className="eyebrow">{report.term_name}</p><h3>Report</h3><ReportResults studentId={selected.id} term={report.term} /><h4>School comment</h4><p>{report.report_comment}</p><div className="report-card-footer"><p className="text-muted">Finalized {formatDate(report.finalized_at || report.edited_at || report.generated_at)}</p><button type="button" className="secondary" onClick={() => downloadCard(report)}>Download report card</button></div></article>)}</div> : <div className="empty-state"><h3>No finalized reports are available yet.</h3></div>)}
        </article>
      </section>
    )
  }

  return (
    <section>
      <div className="panel-header"><div><h2>Students</h2><p className="text-muted">View your children's school progress.</p></div></div>
      {error && <div className="error-banner">{error}<button type="button" className="secondary retry-button" onClick={loadStudents}>Retry</button></div>}
      {loading || detailLoading ? <div className="announcement-skeleton" aria-label="Loading students"><span /><span /></div> : students.length === 0 ? <div className="empty-state"><h3>No students are linked to this account yet.</h3><p>Please contact the school office.</p></div> : <div className="guardian-student-list">{students.map((student) => <article className="card guardian-student-card" key={student.id}><div><p className="eyebrow">{student.school_class_name || 'Student'}</p><h3>{student.first_name} {student.last_name}</h3><p className="text-muted">{student.house ? `Sports house: ${student.house}` : 'School student'}</p></div><button type="button" onClick={() => openStudent(student.id)}>View progress</button></article>)}</div>}
    </section>
  )
}

// The child's week: their class's lessons in the subjects they take.
function ChildTimetable({ studentId }) {
  const [week, setWeek] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api.guardianStudents.timetable(studentId).then(setWeek).catch((err) => setError(err.message)) }, [studentId])
  if (error) return <div className="error-banner">{error}</div>
  if (!week) return <p className="text-muted">Loading…</p>
  return (
    <div className="card">
      {week.lessons.length === 0
        ? <p className="text-muted" style={{ margin: 0 }}>The school hasn&apos;t published a timetable yet.</p>
        : <WeekGrid week={week} show="teacher" />}
    </div>
  )
}

const SHORT = { dateStyle: 'medium', timeStyle: 'short' }
const LEAVE_KINDS = [['weekend', 'Weekend'], ['half_term', 'Half term'], ['exeat', 'Exeat'], ['appointment', 'Appointment'], ['other', 'Other']]

// Boarders: where they sleep, leave (ask for it here) and sick bay visits.
function ChildBoarding({ studentId, firstName }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = () => api.guardianStudents.boarding(studentId).then(setData).catch((err) => setError(err.message))
  useEffect(() => { load() }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function ask(e) {
    e.preventDefault()
    setError('')
    try {
      await api.guardianStudents.requestLeave(studentId, { ...form, leaving_at: new Date(form.leaving_at).toISOString(),
        returning_at: new Date(form.returning_at).toISOString() })
      setForm(null)
      setNotice('Sent. The boarding staff will approve or decline it, and you will get an email.')
      load()
    } catch (err) {
      const first = Object.values(err.data || {}).flat().find((v) => typeof v === 'string')
      setError(first || err.message)
    }
  }
  async function cancel(id) {
    try {
      await api.guardianStudents.cancelLeave(studentId, id)
      setNotice('Leave cancelled.')
      load()
    } catch (err) {
      setError(err.message)
    }
  }
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  if (error && !data) return <div className="error-banner">{error}</div>
  if (!data) return <p className="text-muted">Loading…</p>
  if (!data.boarder) return <div className="card"><p className="text-muted" style={{ margin: 0 }}>{firstName} doesn&apos;t have a bed in a boarding house yet.</p></div>
  const where = { in: 'In the boarding house', on_leave: 'On leave', sick_bay: 'In the sick bay' }[data.where]
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <div className="card">
        <p style={{ margin: 0 }}><strong>{data.house}</strong> · {data.dorm} · {data.bed}</p>
        <p className="text-muted" style={{ margin: '4px 0 0' }}>Now: {where}</p>
      </div>
      <div className="card">
        <div className="support-row">
          <h3 style={{ fontSize: 15, margin: 0 }}>Leave</h3>
          {!form && <button type="button" style={{ width: 'auto' }} onClick={() => setForm({ kind: 'weekend', leaving_at: '', returning_at: '', collected_by: '', reason: '' })}>Ask for leave</button>}
        </div>
        {form && (
          <form onSubmit={ask} className="tt-form-grid" style={{ marginTop: 10 }}>
            <label>Kind<select value={form.kind} onChange={set('kind')}>{LEAVE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label>Leaving<input type="datetime-local" value={form.leaving_at} onChange={set('leaving_at')} required /></label>
            <label>Back<input type="datetime-local" value={form.returning_at} onChange={set('returning_at')} required /></label>
            <label>Who will collect {firstName}<input value={form.collected_by} onChange={set('collected_by')} placeholder="e.g. me, or their uncle Peter" required /></label>
            <label>Reason<input value={form.reason} onChange={set('reason')} /></label>
            <div className="tt-form-actions">
              <button type="submit" style={{ width: 'auto' }}>Send request</button>
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        )}
        {data.leave.length === 0 ? <p className="text-muted" style={{ margin: '8px 0 0' }}>No leave yet.</p> : (
          <ul className="support-list">
            {data.leave.map((l) => (
              <li key={l.id}>
                <div className="support-row">
                  <div>
                    <strong>{l.kind_label}</strong> · {formatDateTime(l.leaving_at, SHORT)} to {formatDateTime(l.returning_at, SHORT)}
                    <div className="hint" style={{ margin: 0 }}>{[l.status_label, l.decision_note].filter(Boolean).join(' · ')}</div>
                  </div>
                  {['requested', 'approved'].includes(l.status) && (
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => cancel(l.id)}>Cancel</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Sick bay visits</h3>
        {data.sick_bay.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None.</p> : (
          <ul className="support-list">
            {data.sick_bay.map((v) => (
              <li key={v.id}>
                <strong>{formatDateTime(v.checked_in_at, SHORT)}</strong> · {v.complaint}
                <div className="hint" style={{ margin: 0 }}>{[v.treatment, v.checked_out_at ? v.outcome_label : 'Still in the sick bay'].filter(Boolean).join(' · ')}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// The child's clubs and teams: when they meet, attendance, fixtures and results.
export function ChildClubs({ clubs, firstName }) {
  if (clubs === undefined) return <p className="text-muted">Loading…</p>
  if (!clubs || clubs.length === 0) return <p className="text-muted">{firstName} isn't in any school clubs or teams yet.</p>
  return clubs.map((c) => (
    <div className="card" key={c.id}>
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>{c.name}{c.role && <span className="badge finalized" style={{ marginLeft: 8 }}>{c.role}</span>}</h3>
      <p className="text-muted" style={{ margin: '0 0 6px' }}>{[c.kind_label, c.meets, c.location, c.leaders?.length ? `Run by ${c.leaders.join(', ')}` : ''].filter(Boolean).join(' · ')}</p>
      {c.attendance?.sessions > 0 && (
        <p style={{ margin: '0 0 6px' }}>Came to <strong>{c.attendance.present} of {c.attendance.sessions}</strong> sessions{c.attendance.excused ? ` (${c.attendance.excused} excused)` : ''}.</p>
      )}
      {c.upcoming?.length > 0 && (
        <>
          <h4 className="cover-sub">Coming up</h4>
          <ul className="fixture-list">{c.upcoming.map((f) => <FixtureLine key={f.id} fixture={f}>{f.selected && <span className="badge finalized">{firstName} is in the squad</span>}</FixtureLine>)}</ul>
        </>
      )}
      {c.results?.length > 0 && (
        <>
          <h4 className="cover-sub">Results</h4>
          <ul className="fixture-list">{c.results.map((f) => (
            <FixtureLine key={f.id} fixture={f}>
              {f.selected && <span className="hint">{firstName} played.</span>}
              {f.report && <span className="hint">{f.report}</span>}
            </FixtureLine>
          ))}</ul>
        </>
      )}
    </div>
  ))
}

// Merits the school has shared (rewards), then behaviour records; staff notes never reach parents.
export function ChildBehaviour({ rows, merits, firstName }) {
  if (!rows) return <p className="text-muted">Loading…</p>
  const points = (merits || []).reduce((sum, m) => sum + (m.points || 0), 0)
  return (
    <>
      {merits && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 6 }}>Merits{merits.length > 0 ? ` · ${points} point${points === 1 ? '' : 's'}` : ''}</h3>
          {merits.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No merits yet.</p> : (
            <ul className="support-list">
              {merits.map((m) => (
                <li key={m.id} className="discipline-item">
                  <div className="discipline-head">
                    <span className="badge merit-points">+{m.points}</span>
                    <strong>{m.category_label}</strong>
                    <span className="text-muted">· {formatDate(m.date)}</span>
                  </div>
                  {m.reason && <p style={{ margin: '4px 0' }}>{m.reason}</p>}
                  {m.awarded_by_name && <div className="hint" style={{ margin: 0 }}>Given by {m.awarded_by_name}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className={merits ? 'card' : undefined}>
        {merits && <h3 style={{ fontSize: 15, marginBottom: 6 }}>Behaviour records</h3>}
        <BehaviourRecords rows={rows} firstName={firstName} />
      </div>
    </>
  )
}

function BehaviourRecords({ rows, firstName }) {
  if (rows.length === 0) return <p className="text-muted" style={{ margin: 0 }}>The school hasn't shared any behaviour records about {firstName}.</p>
  return (
    <ul className="support-list">
      {rows.map((i) => (
        <li key={i.id} className="discipline-item">
          <div className="discipline-head">
            <span className={`badge ${{ minor: 'draft', moderate: 'pending', serious: 'rejected' }[i.severity] || 'draft'}`}>{i.severity_label}</span>
            <strong>{i.category_label}</strong>
            <span className="text-muted">· {formatDate(i.date)}</span>
          </div>
          <p style={{ margin: '4px 0' }}>{i.description}</p>
          <div className="hint" style={{ margin: 0 }}>{[i.action_label, i.action_detail, i.recorded_by_name && `Recorded by ${i.recorded_by_name}`].filter(Boolean).join(' · ')}</div>
        </li>
      ))}
    </ul>
  )
}

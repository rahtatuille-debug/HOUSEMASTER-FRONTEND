import { useEffect, useState } from 'react'
import TermSummary from './TermSummary.jsx'
import { formatDate as localDate } from '../format.js'
import { useWithLevel, useVocab } from '../levels.js'
import { api } from '../api.js'
import PerformanceChart from './PerformanceChart.jsx'
import HealthNotesCard from './HealthNotesCard.jsx'
import SupportCard from './SupportCard.jsx'

const GENDERS = { female: 'Female', male: 'Male', other: 'Other' }
const MODES = { day: 'Day', boarding: 'Boarding' }
const TABS = ['overview', 'progress', 'grades', 'attendance', 'reports']

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
          <p className="text-muted">{selected.school_class_name || 'Class not assigned'}{selected.house ? ` · ${selected.house} House` : ''}</p>
          {profile?.support && <div style={{ margin: '12px 0' }}><SupportCard concern={profile.support} forParents /></div>}
          <div className="guardian-subtabs" role="tablist" aria-label="Student information">
            {TABS.map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'active-filter' : 'secondary'} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}
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
                    <li><span>House</span> {selected.house || '—'}</li>
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
      {loading || detailLoading ? <div className="announcement-skeleton" aria-label="Loading students"><span /><span /></div> : students.length === 0 ? <div className="empty-state"><h3>No students are linked to this account yet.</h3><p>Please contact the school office.</p></div> : <div className="guardian-student-list">{students.map((student) => <article className="card guardian-student-card" key={student.id}><div><p className="eyebrow">{student.school_class_name || 'Student'}</p><h3>{student.first_name} {student.last_name}</h3><p className="text-muted">{student.house ? `${student.house} House` : 'School student'}</p></div><button type="button" onClick={() => openStudent(student.id)}>View progress</button></article>)}</div>}
    </section>
  )
}

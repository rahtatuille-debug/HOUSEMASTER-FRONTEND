import { useEffect, useState } from 'react'
import { api } from '../api.js'

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—'
}

function percentage(grade) {
  const score = Number(grade.score)
  const maximum = Number(grade.max_score)
  return Number.isFinite(score) && Number.isFinite(maximum) && maximum > 0
    ? `${Math.round((score / maximum) * 100)}%`
    : '—'
}

export default function GuardianStudents() {
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [tab, setTab] = useState('overview')
  const [grades, setGrades] = useState([])
  const [reports, setReports] = useState([])
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

  async function openStudent(id) {
    setDetailLoading(true)
    setError('')
    try {
      const [student, studentGrades, studentReports] = await Promise.all([
        api.guardianStudents.get(id),
        api.guardianStudents.grades(id),
        api.guardianStudents.reports(id),
      ])
      setSelected(student)
      setGrades(studentGrades)
      setReports(studentReports)
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
          <div className="guardian-subtabs" role="tablist" aria-label="Student information">
            {['overview', 'grades', 'reports'].map((name) => <button key={name} type="button" role="tab" aria-selected={tab === name} className={tab === name ? 'active-filter' : 'secondary'} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}
          </div>
          {tab === 'overview' && <div className="guardian-overview"><div><span>Class</span><strong>{selected.school_class_name || '—'}</strong></div><div><span>House</span><strong>{selected.house || '—'}</strong></div><div><span>Enrolled</span><strong>{formatDate(selected.enrolled_on)}</strong></div></div>}
          {tab === 'grades' && (grades.length ? <div className="table-wrap"><table><thead><tr><th>Subject</th><th>Term</th><th>Score</th><th>Result</th><th>Recorded</th></tr></thead><tbody>{grades.map((grade) => <tr key={grade.id}><td>{grade.subject_name}</td><td>{grade.term_name}</td><td>{grade.score} / {grade.max_score}</td><td>{percentage(grade)}</td><td>{formatDate(grade.recorded_at)}</td></tr>)}</tbody></table></div> : <div className="empty-state"><h3>No grades have been recorded yet.</h3></div>)}
          {tab === 'reports' && (reports.length ? <div className="guardian-reports">{reports.map((report) => <article className="report-doc" key={report.id}><p className="eyebrow">{report.term_name}</p><h3>Progress review</h3><h4>Progress summary</h4><p>{report.progress_summary}</p><h4>School comment</h4><p>{report.report_comment}</p><p className="text-muted">Finalized {formatDate(report.edited_at || report.generated_at)}</p></article>)}</div> : <div className="empty-state"><h3>No finalized reports are available yet.</h3></div>)}
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

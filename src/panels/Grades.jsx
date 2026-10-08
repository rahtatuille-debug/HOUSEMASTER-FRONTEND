import { useEffect, useState } from 'react'
import { perms } from '../permissions.js'
import { levelFor, levelMidpoint, levelsForScale, useSchool, useVocab } from '../levels.js'
import StudentSelect from './StudentSelect.jsx'
import { api, isPage } from '../api.js'
import { loadDraft, saveDraft } from '../drafts.js'
import ShowMore, { PAGE } from './ShowMore.jsx'

// Teachers can see every subject's grades for students in their classes,
// but only add or change grades for the subjects they teach there.
export default function Grades({ me }) {
  const school = useSchool()
  // CBC schools can record a level instead of marks (pre-primary is assessed
  // on the rubric only). It's stored as the middle of that level's band.
  const canRecordLevel = school?.education_system === 'cbc' && school.levels?.length > 0
  const [byLevel, setByLevel] = useState(false)
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([])
  const [grades, setGrades] = useState([])
  // Marks come from the server a page at a time: how many there are in all,
  // and the next page to fetch (null when everything is loaded, or when an
  // older backend sent the whole list and it is paged on screen instead).
  const [gradesTotal, setGradesTotal] = useState(0)
  const [nextPage, setNextPage] = useState(null)
  const [serverPaged, setServerPaged] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [filterStudent, setFilterStudent] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [filterTerm, setFilterTerm] = useState('')

  // A mark typed but not saved (a failed save on a weak signal, or the app
  // closed) is kept on the phone and comes back here (drafts.js).
  const [form, setForm] = useState(() => loadDraft(me?.id, 'grade-form')?.form
    || { student: '', subject: '', term: '', score: '', max_score: '100', assessment_type: '' })
  const [types, setTypes] = useState([])
  const [editingId, setEditingId] = useState(() => loadDraft(me?.id, 'grade-form')?.editingId ?? null)
  useEffect(() => {
    const typed = form.student || form.subject || form.term || form.score !== ''
    saveDraft(me?.id, 'grade-form', typed ? { form, editingId } : null)
  }, [me?.id, form, editingId])

  async function loadOptions() {
    try {
      const [s, subj, t, at] = await Promise.all([
        api.students.list({ is_active: true }),
        api.subjects.list(),
        api.terms.list(),
        api.assessmentTypes.list(),
      ])
      setTypes(at)
      setStudents(s)
      setSubjects(subj)
      setTerms(t)
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadGrades() {
    setLoading(true)
    setError('')
    try {
      const data = await api.grades.page({ student: filterStudent, term: filterTerm, page: 1, page_size: PAGE })
      setServerPaged(isPage(data))
      if (isPage(data)) {
        setGrades(data.results)
        setGradesTotal(data.count)
        setNextPage(data.next ? 2 : null)
      } else {
        setGrades(data)
        setGradesTotal(data.length)
        setNextPage(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function loadMoreGrades() {
    if (!nextPage) {
      setLimit(limit + PAGE)
      return
    }
    setLoadingMore(true)
    try {
      const data = await api.grades.page({ student: filterStudent, term: filterTerm, page: nextPage, page_size: PAGE })
      setGrades((current) => [...current, ...data.results])
      setNextPage(data.next ? nextPage + 1 : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  // Paged by the server: show everything loaded so far. A whole list from
  // an older backend is paged on screen as before.
  const shownGrades = serverPaged ? grades : grades.slice(0, limit)

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    loadGrades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStudent, filterTerm])
  useEffect(() => setLimit(PAGE), [filterStudent, filterTerm])

  function resetForm() {
    setEditingId(null)
    setForm((f) => ({ student: '', subject: '', term: '', score: '', max_score: '100', assessment_type: f.assessment_type }))
  }

  function startEdit(g) {
    setEditingId(g.id)
    setForm({
      student: String(g.student),
      subject: String(g.subject),
      term: String(g.term),
      score: String(g.score),
      max_score: String(g.max_score),
      assessment_type: g.assessment_type ? String(g.assessment_type) : '',
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.student || !form.subject || !form.term || form.score === '') return
    const body = {
      student: Number(form.student),
      subject: Number(form.subject),
      term: Number(form.term),
      score: form.score,
      max_score: form.max_score || '100',
      assessment_type: form.assessment_type ? Number(form.assessment_type) : null,
    }
    try {
      if (editingId) {
        await api.grades.update(editingId, body)
      } else {
        await api.grades.create(body)
      }
      resetForm()
      loadGrades()
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(id) {
    try {
      await api.grades.remove(id)
      loadGrades()
    } catch (err) {
      setError(err.message)
    }
  }

  const studentName = (id) => {
    const s = students.find((s) => s.id === id)
    return s ? `${s.first_name} ${s.last_name}` : `#${id}`
  }
  const subjectName = (id) => { const s = subjects.find((x) => x.id === id); return s ? (s.label || s.name) : `#${id}` }
  const termName = (id) => terms.find((t) => t.id === id)?.name || `#${id}`

  function canGrade(studentId, subjectId) {
    // Leaders grade anything; a Head of Department their subject in any class.
    if (isAdmin || perms(me).is_leader) return true
    if ((me?.roles || []).some((r) => r.role === 'head_of_department' && r.subject === Number(subjectId))) return true
    const student = students.find((s) => s.id === Number(studentId))
    if (!student) return false
    return (me?.assignments || []).some(
      // An assignment with no subject covers every subject in that class.
      (a) => a.school_class === student.school_class && (a.subject === null || a.subject === Number(subjectId))
    )
  }

  // Only subjects the chosen student takes: their curriculum's core subjects plus their electives.
  const takes = (studentId, subject) => {
    const student = students.find((st) => st.id === Number(studentId))
    if (student?.section && subject.section && student.section !== subject.section) return false
    return !subject.is_elective || (student?.subject_choices || []).some((c) => c.subject === subject.id)
  }
  // The chosen student's grading scale (their section's, in a school running two curricula).
  const formLevels = levelsForScale(school, students.find((st) => st.id === Number(form.student))?.scale)
  const formSubjects = form.student ? subjects.filter((s) => canGrade(form.student, s.id) && takes(form.student, s)) : subjects

  const noPrereqs = subjects.length === 0 || terms.length === 0

  return (
    <div>
      <div className="panel-header">
        <h2>Grades</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {noPrereqs && (
        <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
          <p className="hint" style={{ margin: 0 }}>
            You need at least one {words.subject.toLowerCase()} and one {words.term.toLowerCase()} before recording grades — add those under
            the Setup tab first.
          </p>
        </div>
      )}

      {!noPrereqs && (
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 15 }}>
            {editingId ? 'Edit grade' : 'Record a grade'}
          </h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field" style={{ marginBottom: 0 }}>
                <StudentSelect id="g-student" label="Student" students={students} value={form.student}
                  onChange={(v) => setForm({ ...form, student: v })} required />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="g-subject">{words.subject}</label>
                <select
                  id="g-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {formSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label || s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="g-term">{words.term}</label>
                <select
                  id="g-term"
                  value={form.term}
                  onChange={(e) => setForm({ ...form, term: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              {types.length > 0 && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="g-type">Assessment</label>
                  <select id="g-type" value={form.assessment_type} onChange={(e) => setForm({ ...form, assessment_type: e.target.value })}>
                    <option value="">Not specified</option>
                    {types.map((t) => <option key={t.id} value={t.id}>{t.name} ({Number(t.weight)}%)</option>)}
                  </select>
                </div>
              )}
              {canRecordLevel && (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="g-mode">Record as</label>
                  <select id="g-mode" value={byLevel ? 'level' : 'marks'} onChange={(e) => setByLevel(e.target.value === 'level')}>
                    <option value="marks">Marks</option>
                    <option value="level">Level (e.g. pre-primary)</option>
                  </select>
                </div>
              )}
              {byLevel ? (
                <div className="field" style={{ marginBottom: 0 }}>
                  <label htmlFor="g-level">Level</label>
                  <select id="g-level" required value={levelFor(Number(form.score), { levels: formLevels })?.code || ''}
                    onChange={(e) => setForm({ ...form, score: String(levelMidpoint(formLevels, e.target.value)), max_score: '100' })}>
                    <option value="">Select…</option>
                    {formLevels.map((l) => <option key={l.code} value={l.code}>{l.code} · {l.name}</option>)}
                  </select>
                </div>
              ) : (
              <>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="g-score">Score</label>
                <input
                  id="g-score"
                  type="number"
                  step="0.01"
                  value={form.score}
                  onChange={(e) => setForm({ ...form, score: e.target.value })}
                  required
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="g-max">Out of</label>
                <input
                  id="g-max"
                  type="number"
                  step="0.01"
                  value={form.max_score}
                  onChange={(e) => setForm({ ...form, max_score: e.target.value })}
                />
              </div>
              </>
              )}
            </div>
            <div className="form-actions">
              <button type="submit">{editingId ? 'Save changes' : 'Record grade'}</button>
              {editingId && (
                <button type="button" className="secondary" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="form-row" style={{ marginBottom: 14 }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <StudentSelect id="filter-student" label="Filter by student" students={students} value={filterStudent}
            onChange={setFilterStudent} emptyLabel="All students" />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="filter-term">Filter by term</label>
          <select id="filter-term" value={filterTerm} onChange={(e) => setFilterTerm(e.target.value)}>
            <option value="">All terms</option>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : grades.length === 0 ? (
        <div className="empty-state">
          <h3>No grades recorded</h3>
          <p>Record one above, or adjust the filters.</p>
        </div>
      ) : (
        <>
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>{words.subject}</th>
              <th>{words.term}</th>
              {types.length > 0 && <th>Assessment</th>}
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shownGrades.map((g) => (
              <tr key={g.id}>
                <td className="row-title">{studentName(g.student)}</td>
                <td data-label={words.subject}>{subjectName(g.subject)}</td>
                <td data-label={words.term}>{termName(g.term)}</td>
                {types.length > 0 && <td data-label="Assessment" className="text-muted">{types.find((t) => t.id === g.assessment_type)?.name || '—'}</td>}
                <td data-label="Score" className="mono">{g.score} / {g.max_score}</td>
                <td className="row-actions" style={{ display: 'flex', gap: 8 }}>
                  {canGrade(g.student, g.subject) && (
                    <>
                      <button className="secondary" onClick={() => startEdit(g)}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => remove(g.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ShowMore shown={shownGrades.length} total={gradesTotal} onMore={loadingMore ? () => {} : loadMoreGrades} noun="marks" />
        </>
      )}
    </div>
  )
}

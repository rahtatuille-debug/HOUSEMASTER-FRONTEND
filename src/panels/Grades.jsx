import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Grades() {
  const [students, setStudents] = useState([])
  const [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([])
  const [grades, setGrades] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [filterStudent, setFilterStudent] = useState('')
  const [filterTerm, setFilterTerm] = useState('')

  const [form, setForm] = useState({ student: '', subject: '', term: '', score: '', max_score: '100' })
  const [editingId, setEditingId] = useState(null)

  async function loadOptions() {
    try {
      const [s, subj, t] = await Promise.all([
        api.students.list({ is_active: true }),
        api.subjects.list(),
        api.terms.list(),
      ])
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
      const data = await api.grades.list({ student: filterStudent, term: filterTerm })
      setGrades(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    loadGrades()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStudent, filterTerm])

  function resetForm() {
    setEditingId(null)
    setForm({ student: '', subject: '', term: '', score: '', max_score: '100' })
  }

  function startEdit(g) {
    setEditingId(g.id)
    setForm({
      student: String(g.student),
      subject: String(g.subject),
      term: String(g.term),
      score: String(g.score),
      max_score: String(g.max_score),
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
  const subjectName = (id) => subjects.find((s) => s.id === id)?.name || `#${id}`
  const termName = (id) => terms.find((t) => t.id === id)?.name || `#${id}`

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
            You need at least one Subject and one Term before recording grades — add those under
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
                <label htmlFor="g-student">Student</label>
                <select
                  id="g-student"
                  value={form.student}
                  onChange={(e) => setForm({ ...form, student: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="g-subject">Subject</label>
                <select
                  id="g-subject"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="g-term">Term</label>
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
          <label htmlFor="filter-student">Filter by student</label>
          <select id="filter-student" value={filterStudent} onChange={(e) => setFilterStudent(e.target.value)}>
            <option value="">All students</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.first_name} {s.last_name}
              </option>
            ))}
          </select>
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
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Subject</th>
              <th>Term</th>
              <th>Score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grades.map((g) => (
              <tr key={g.id}>
                <td>{studentName(g.student)}</td>
                <td>{subjectName(g.subject)}</td>
                <td>{termName(g.term)}</td>
                <td className="mono">{g.score} / {g.max_score}</td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="secondary" onClick={() => startEdit(g)}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => remove(g.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

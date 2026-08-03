import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Setup() {
  const [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [subjectName, setSubjectName] = useState('')
  const [termName, setTermName] = useState('')
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [s, t] = await Promise.all([api.subjects.list(), api.terms.list()])
      setSubjects(s)
      setTerms(t)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function addSubject(e) {
    e.preventDefault()
    if (!subjectName.trim()) return
    try {
      await api.subjects.create({ name: subjectName.trim() })
      setSubjectName('')
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function addTerm(e) {
    e.preventDefault()
    if (!termName.trim() || !termStart || !termEnd) return
    try {
      await api.terms.create({ name: termName.trim(), start_date: termStart, end_date: termEnd })
      setTermName('')
      setTermStart('')
      setTermEnd('')
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="panel-header">
        <h2>Setup</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Subjects</h3>
        <form onSubmit={addSubject} className="form-row" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="subject-name">New subject</label>
            <input
              id="subject-name"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Mathematics"
            />
          </div>
          <button type="submit">Add subject</button>
        </form>
        {!loading && subjects.length === 0 && (
          <p className="hint">No subjects yet — add one above before recording grades.</p>
        )}
        {subjects.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {subjects.map((s) => (
              <li key={s.id}>{s.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Terms</h3>
        <form onSubmit={addTerm} className="form-row" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="term-name">Term name</label>
            <input
              id="term-name"
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              placeholder="e.g. Term 1 2026"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="term-start">Start date</label>
            <input id="term-start" type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="term-end">End date</label>
            <input id="term-end" type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
          </div>
          <button type="submit">Add term</button>
        </form>
        {!loading && terms.length === 0 && (
          <p className="hint">No terms yet — add one above before recording grades or generating reports.</p>
        )}
        {terms.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.start_date}</td>
                  <td>{t.end_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
        <h3 style={{ marginBottom: 8, fontSize: 15 }}>Classes</h3>
        <p className="hint" style={{ marginTop: 0 }}>
          Class management (e.g. "7A", "Year 9 Blue") isn't available here yet — the backend
          needs a Year Group API added first. For now, classes can be created via the Django
          admin panel at <span className="mono">/admin/</span>.
        </p>
      </div>
    </div>
  )
}

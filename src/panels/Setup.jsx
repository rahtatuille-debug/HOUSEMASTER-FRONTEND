import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Setup() {
  const [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([])
  const [yearGroups, setYearGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [subjectName, setSubjectName] = useState('')
  const [termName, setTermName] = useState('')
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')
  const [yearGroupName, setYearGroupName] = useState('')
  const [className, setClassName] = useState('')
  const [classYearGroup, setClassYearGroup] = useState('')
  const [classHouse, setClassHouse] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [s, t, yg, cls] = await Promise.all([
        api.subjects.list(),
        api.terms.list(),
        api.yearGroups.list(),
        api.schoolClasses.list(),
      ])
      setSubjects(s)
      setTerms(t)
      setYearGroups(yg)
      setClasses(cls)
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

  async function addYearGroup(e) {
    e.preventDefault()
    if (!yearGroupName.trim()) return
    try {
      await api.yearGroups.create({ name: yearGroupName.trim() })
      setYearGroupName('')
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function addClass(e) {
    e.preventDefault()
    if (!className.trim() || !classYearGroup) return
    try {
      await api.schoolClasses.create({
        name: className.trim(),
        year_group: Number(classYearGroup),
        house: classHouse.trim(),
      })
      setClassName('')
      setClassHouse('')
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeClass(id) {
    try {
      await api.schoolClasses.remove(id)
      loadAll()
    } catch (err) {
      setError(err.message)
    }
  }

  const yearGroupName_ = (id) => yearGroups.find((yg) => yg.id === id)?.name || `#${id}`

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

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Year groups</h3>
        <form onSubmit={addYearGroup} className="form-row" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="yg-name">New year group</label>
            <input
              id="yg-name"
              value={yearGroupName}
              onChange={(e) => setYearGroupName(e.target.value)}
              placeholder="e.g. Year 7"
            />
          </div>
          <button type="submit">Add year group</button>
        </form>
        {!loading && yearGroups.length === 0 && (
          <p className="hint">No year groups yet — add one above before creating classes.</p>
        )}
        {yearGroups.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {yearGroups.map((yg) => (
              <li key={yg.id}>{yg.name}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>Classes</h3>
        {yearGroups.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Add a year group first, then classes can be created within it.
          </p>
        ) : (
          <>
            <form onSubmit={addClass} className="form-row" style={{ marginBottom: 16 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="class-year-group">Year group</label>
                <select
                  id="class-year-group"
                  value={classYearGroup}
                  onChange={(e) => setClassYearGroup(e.target.value)}
                >
                  <option value="">Select…</option>
                  {yearGroups.map((yg) => (
                    <option key={yg.id} value={yg.id}>
                      {yg.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="class-name">Class name</label>
                <input
                  id="class-name"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. 7A"
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="class-house">House</label>
                <input
                  id="class-house"
                  value={classHouse}
                  onChange={(e) => setClassHouse(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <button type="submit">Add class</button>
            </form>
            {classes.length === 0 ? (
              <p className="hint">No classes yet — add one above.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Year group</th>
                    <th>House</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{yearGroupName_(c.year_group)}</td>
                      <td>{c.house || '—'}</td>
                      <td>
                        <button className="danger" onClick={() => removeClass(c.id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  )
}

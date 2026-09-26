import { useEffect, useState } from 'react'
import { api } from '../api.js'

function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Download a class's list, grades, attendance or finalized reports.
// Teachers only see the classes they teach (the API enforces this too).
export default function Exports({ me }) {
  const isAdmin = me?.role === 'admin'
  const [classes, setClasses] = useState([])
  const [terms, setTerms] = useState([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [start, setStart] = useState(() => isoDate(new Date(Date.now() - 30 * 86400000)))
  const [end, setEnd] = useState(() => isoDate(new Date()))
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.schoolClasses.list(), api.terms.list()])
      .then(([cls, trm]) => {
        const mine = isAdmin ? cls : cls.filter((c) => (me?.assignments || []).some((a) => a.school_class === c.id))
        setClasses(mine)
        setTerms(trm)
        if (mine.length === 1) setClassId(String(mine[0].id))
        const today = isoDate(new Date())
        const current = trm.find((t) => t.start_date && t.end_date && t.start_date <= today && today <= t.end_date)
        const chosen = current || trm[trm.length - 1]
        if (chosen) setTermId(String(chosen.id))
        if (current) {
          setStart(current.start_date)
          setEnd(today)
        }
      })
      .catch((err) => setError(err.message))
  }, [isAdmin, me])

  async function download(key, path, params) {
    setBusy(key)
    setError('')
    try {
      await api.download(path, params)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  const noClass = !classId
  const EXPORTS = [
    {
      key: 'class-list',
      title: 'Class list',
      text: 'Every active student with admission number, details, parents and their emails, and health notes.',
      format: 'Excel',
      needs: [],
      run: () => download('class-list', '/api/exports/class-list/', { school_class: classId }),
    },
    {
      key: 'grades',
      title: 'Grades',
      text: 'One row per student, one column per subject (as a percentage), with each student’s average.',
      format: 'Excel',
      needs: ['term'],
      run: () => download('grades', '/api/exports/grades/', { school_class: classId, term: termId }),
    },
    {
      key: 'attendance',
      title: 'Attendance',
      text: 'A summary per student for the dates chosen, plus a day-by-day register.',
      format: 'Excel',
      needs: ['dates'],
      run: () => download('attendance', '/api/exports/attendance/', { school_class: classId, start, end }),
    },
    {
      key: 'reports',
      title: 'Reports',
      text: 'Every finalized report for the term, one page per student, ready to print.',
      format: 'PDF',
      needs: ['term'],
      run: () => download('reports', '/api/exports/reports/', { school_class: classId, term: termId }),
    },
  ]

  return (
    <div>
      <div className="panel-header">
        <h2>Exports</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="form-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ex-class">Class</label>
            <select id="ex-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ex-term">Term (grades and reports)</label>
            <select id="ex-term" value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">Select…</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ex-start">Attendance from</label>
            <input id="ex-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="ex-end">to</label>
            <input id="ex-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        {!isAdmin && classes.length === 0 && (
          <p className="hint">You aren't assigned to any classes yet, so there's nothing to export.</p>
        )}
        <p className="hint">These files contain students' personal details. Store and share them carefully.</p>
      </div>

      <div className="export-grid">
        {EXPORTS.map((x) => {
          const missing = noClass || (x.needs.includes('term') && !termId) || (x.needs.includes('dates') && (!start || !end))
          return (
            <div className="card" key={x.key} style={{ marginBottom: 0 }}>
              <div className="panel-header" style={{ marginBottom: 6 }}>
                <h3 style={{ fontSize: 15 }}>{x.title}</h3>
                <span className="badge pending">{x.format}</span>
              </div>
              <p className="text-muted" style={{ margin: '0 0 12px', fontSize: 14 }}>{x.text}</p>
              <button type="button" onClick={x.run} disabled={missing || busy === x.key}>
                {busy === x.key ? 'Preparing…' : `Download ${x.format === 'PDF' ? 'PDF' : 'spreadsheet'}`}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

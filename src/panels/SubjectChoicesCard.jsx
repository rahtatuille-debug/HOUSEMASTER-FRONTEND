import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useSchool, useVocab } from '../levels.js'

// Which electives each student in a class takes, plus IB Higher/Standard
// Level and CBC senior school pathways. Core subjects are taken by everyone.
export default function SubjectChoicesCard({ me }) {
  const words = useVocab()
  const school = useSchool()
  const isAdmin = me?.role === 'admin'
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [data, setData] = useState(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.schoolClasses.list().then((cls) => {
      const mine = me?.assignments || []
      setClasses(isAdmin ? cls : cls.filter((c) => mine.some((a) => a.school_class === c.id)))
    }).catch((err) => setError(err.message))
  }, [isAdmin, me])

  useEffect(() => {
    setData(null)
    setNotice('')
    if (!classId) return
    api.subjectChoices.get(classId).then((d) => { setData(d); setDirty(false) }).catch((err) => setError(err.message))
  }, [classId])

  // The class's own system: a school running two systems may have an IB section.
  const ib = (data?.system ?? school?.education_system) === 'ib'
  // IB students can take any subject at Higher or Standard Level; elsewhere only electives are chosen.
  const columns = data ? data.subjects.filter((s) => s.is_elective || ib) : []

  function choiceFor(row, subjectId) {
    return row.subjects.find((c) => c.subject === subjectId)
  }

  function setChoice(i, subjectId, value) {
    // value: null = not taking, '' = taking, 'SL' / 'HL' = taking at that level
    setData((d) => {
      const students = [...d.students]
      const row = students[i]
      const rest = row.subjects.filter((c) => c.subject !== subjectId)
      students[i] = { ...row, subjects: value === null ? rest : [...rest, { subject: subjectId, level: value }] }
      return { ...d, students }
    })
    setDirty(true)
    setNotice('')
  }

  function setPathway(i, pathway) {
    setData((d) => {
      const students = [...d.students]
      students[i] = { ...students[i], pathway }
      return { ...d, students }
    })
    setDirty(true)
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const d = await api.subjectChoices.save(classId, data.students)
      setData(d)
      setDirty(false)
      setNotice('Subject choices saved.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6, fontSize: 15 }}>{words.subject} choices</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Everyone takes the core {words.subjects.toLowerCase()}. Tick the electives each student takes
        {ib ? ', and choose Higher or Standard Level' : ''}{data?.pathways?.length ? ', and set each student\'s pathway' : ''}.
        Marks can only be recorded in {words.subjects.toLowerCase()} a student takes. Mark a {words.subject.toLowerCase()} as an elective in Setup.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <div className="field" style={{ maxWidth: 320 }}>
        <label htmlFor="sc-class">{words.class}</label>
        <select id="sc-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">Select…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {data && (columns.length === 0 && !data.pathways.length ? (
        <p className="text-muted">No electives yet. Mark {words.subjects.toLowerCase()} as electives in Setup to choose them here.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="entry-grid">
              <thead>
                <tr>
                  <th>Student</th>
                  {data.pathways.length > 0 && <th>Pathway (senior school)</th>}
                  {columns.map((s) => <th key={s.id}>{s.name}{s.is_elective ? '' : ' (core)'}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.students.map((row, i) => (
                  <tr key={row.student}>
                    <td style={{ whiteSpace: 'nowrap' }}>{row.name}</td>
                    {data.pathways.length > 0 && (
                      <td>
                        <select aria-label={`Pathway for ${row.name}`} value={row.pathway} onChange={(e) => setPathway(i, e.target.value)}>
                          <option value="">—</option>
                          {data.pathways.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                    )}
                    {columns.map((s) => {
                      const choice = choiceFor(row, s.id)
                      if (!ib) {
                        return (
                          <td key={s.id} style={{ textAlign: 'center' }}>
                            <input type="checkbox" aria-label={`${row.name} takes ${s.name}`} style={{ width: 'auto' }}
                              checked={!!choice} onChange={(e) => setChoice(i, s.id, e.target.checked ? '' : null)} />
                          </td>
                        )
                      }
                      const value = choice ? (choice.level || 'yes') : (s.is_elective ? 'no' : 'yes')
                      return (
                        <td key={s.id}>
                          <select aria-label={`${row.name}: ${s.name}`} value={value}
                            onChange={(e) => setChoice(i, s.id, e.target.value === 'no' ? null : e.target.value === 'yes' ? (s.is_elective ? '' : null) : e.target.value)}>
                            {s.is_elective && <option value="no">Not taking</option>}
                            <option value="yes">{s.is_elective ? 'Taking' : '—'}</option>
                            <option value="SL">SL</option>
                            <option value="HL">HL</option>
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save choices'}</button>
          </div>
        </>
      ))}
    </div>
  )
}

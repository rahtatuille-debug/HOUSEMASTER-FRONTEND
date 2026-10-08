import { useEffect, useState } from 'react'
import { classesFor, perms } from '../permissions.js'
import { api } from '../api.js'
import { useVocab } from '../levels.js'

const EFFORT = ['', '1', '2', '3', '4']

// Subject teachers' end-of-term entries for a whole class: a comment for each
// student, plus effort and target grades (British) or criteria A-D (IB MYP).
// These are printed on the report card beside the marks.
export default function SubjectReportsCard({ me, terms }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [pick, setPick] = useState({ school_class: '', subject: '', term: '' })
  const [rows, setRows] = useState(null)
  const [fields, setFields] = useState([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    Promise.all([api.schoolClasses.list(), api.subjects.list()]).then(([cls, subj]) => {
      setClasses(classesFor(me, cls, 'academic'))
      setSubjects(subj)
    }).catch((err) => setError(err.message))
  }, [isAdmin, me])

  // Only the chosen class's curriculum, and for teachers only the subjects they teach there.
  const chosenClass = classes.find((c) => c.id === Number(pick.school_class))
  const sectionSubjects = chosenClass ? subjects.filter((s) => !s.section || s.section === chosenClass.section) : subjects
  const headOf = new Set((me?.roles || []).filter((r) => r.role === 'head_of_department').map((r) => r.subject))
  const classSubjects = isAdmin || perms(me).is_leader || !pick.school_class ? sectionSubjects : sectionSubjects.filter((s) => headOf.has(s.id) ||
    (me?.assignments || []).some((a) => a.school_class === Number(pick.school_class) && (a.subject == null || a.subject === s.id)))

  useEffect(() => {
    setRows(null)
    setNotice('')
    if (!pick.school_class || !pick.subject || !pick.term) return
    api.subjectReports.list(pick).then((data) => {
      setRows(data.students)
      setFields(data.fields)
      setDirty(false)
    }).catch((err) => setError(err.message))
  }, [pick])

  function change(i, key, value) {
    setRows((current) => current.map((r, j) => (j === i ? { ...r, [key]: value } : r)))
    setDirty(true)
    setNotice('')
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const { saved } = await api.subjectReports.save({
        ...pick,
        entries: rows.map((r) => ({ student: r.student, comment: r.comment, effort: r.effort, target: r.target, criteria: r.criteria })),
      })
      setDirty(false)
      setNotice(`Saved entries for ${saved} student${saved === 1 ? '' : 's'}. They'll appear on the report cards.`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const select = (key, label, options) => (
    <div className="field" style={{ marginBottom: 0 }}>
      <label htmlFor={`sr-${key}`}>{label}</label>
      <select id={`sr-${key}`} value={pick[key]} onChange={(e) => setPick({ ...pick, [key]: e.target.value, ...(key === 'school_class' ? { subject: '' } : {}) })}>
        <option value="">Select…</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.label || o.name}</option>)}
      </select>
    </div>
  )

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6, fontSize: 15 }}>{words.subject} comments</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        What each {words.subject.toLowerCase()} teacher writes for the report card
        {fields.includes('effort') ? ', with effort (1 = excellent to 4) and target grades' : ''}
        {fields.includes('criteria') ? ', with the MYP criteria A to D (each out of 8)' : ''}.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <div className="form-row">
        {select('school_class', words.class, classes)}
        {select('subject', words.subject, classSubjects)}
        {select('term', words.term, terms)}
      </div>

      {rows && (rows.length === 0 ? (
        <p className="text-muted" style={{ marginTop: 14 }}>No students in this {words.class.toLowerCase()}.</p>
      ) : (
        <>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            <table className="entry-grid">
              <thead>
                <tr>
                  <th>Student</th>
                  {fields.includes('effort') && <><th>Effort</th><th>Target</th></>}
                  {fields.includes('criteria') && ['A', 'B', 'C', 'D'].map((c) => <th key={c}>{c}</th>)}
                  <th>Comment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.student}>
                    <td style={{ whiteSpace: 'nowrap' }}>{r.name}</td>
                    {fields.includes('effort') && (
                      <>
                        <td>
                          <select aria-label={`Effort for ${r.name}`} value={r.effort} onChange={(e) => change(i, 'effort', e.target.value)}>
                            {EFFORT.map((v) => <option key={v} value={v}>{v || '—'}</option>)}
                          </select>
                        </td>
                        <td><input aria-label={`Target for ${r.name}`} value={r.target} maxLength={10} onChange={(e) => change(i, 'target', e.target.value)} /></td>
                      </>
                    )}
                    {fields.includes('criteria') && ['A', 'B', 'C', 'D'].map((c) => (
                      <td key={c}>
                        <input aria-label={`Criterion ${c} for ${r.name}`} type="number" min="0" max="8" className="criterion"
                          value={r.criteria?.[c] ?? ''} onChange={(e) => change(i, 'criteria', { ...r.criteria, [c]: e.target.value === '' ? '' : Number(e.target.value) })} />
                      </td>
                    ))}
                    <td>
                      <textarea aria-label={`Comment for ${r.name}`} rows={2} value={r.comment} maxLength={2000}
                        onChange={(e) => change(i, 'comment', e.target.value)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-actions" style={{ marginTop: 12 }}>
            <button type="button" onClick={save} disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save comments'}</button>
          </div>
        </>
      ))}
    </div>
  )
}

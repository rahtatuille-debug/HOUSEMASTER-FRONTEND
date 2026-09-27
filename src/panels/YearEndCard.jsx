import { useEffect, useState } from 'react'
import { useVocab } from '../levels.js'
import { api } from '../api.js'

const STAY = ''
const LEAVE = 'leave'

// End of year (admins): choose where each class's students go, preview, confirm.
export default function YearEndCard({ classes, onDone }) {
  const words = useVocab()
  const [counts, setCounts] = useState({})
  const [targets, setTargets] = useState({})
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function loadCounts() {
    try {
      const students = await api.students.list({ is_active: true })
      const next = {}
      for (const s of students) if (s.school_class) next[s.school_class] = (next[s.school_class] || 0) + 1
      setCounts(next)
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadCounts()
  }, [classes])

  const moves = classes
    .filter((c) => targets[c.id] !== undefined && targets[c.id] !== STAY)
    .map((c) => ({ from_class: c.id, to_class: targets[c.id] === LEAVE ? null : Number(targets[c.id]) }))

  async function run(commit) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await api.promotion(moves, commit)
      if (commit) {
        const moved = result.moves.filter((m) => m.to_class).reduce((a, m) => a + m.students, 0)
        const left = result.moves.filter((m) => !m.to_class).reduce((a, m) => a + m.students, 0)
        setNotice(`Done: ${moved} students moved up and ${left} marked as leaving.`)
        setPreview(null)
        setTargets({})
        loadCounts()
        onDone?.()
      } else {
        setPreview(result.moves)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const withStudents = classes.filter((c) => counts[c.id])

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>End of year: move students up</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        For each class, choose where its students go next year. “Leaving school” deactivates them and keeps all their
        records. Everyone moves at once, so 7A → 8A and 8A → 9A in the same step is fine. Lock last year's terms first
        so nothing in them changes by accident.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      {withStudents.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>No classes with active students.</p>
      ) : (
        <table>
          <thead>
            <tr><th>{words.class}</th><th>Students</th><th>Next year</th></tr>
          </thead>
          <tbody>
            {withStudents.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>{counts[c.id]}</td>
                <td>
                  <select
                    aria-label={`Where ${c.name} moves to`}
                    value={targets[c.id] ?? STAY}
                    onChange={(e) => {
                      setTargets({ ...targets, [c.id]: e.target.value })
                      setPreview(null)
                    }}
                  >
                    <option value={STAY}>Stay in {c.name}</option>
                    {classes.filter((o) => o.id !== c.id).map((o) => (
                      <option key={o.id} value={o.id}>Move to {o.name}</option>
                    ))}
                    <option value={LEAVE}>Leaving school</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {preview && (
        <div className="note-box" style={{ borderLeftColor: 'var(--gold)', background: 'var(--paper)', marginTop: 14 }}>
          <strong style={{ color: 'var(--navy)' }}>This will</strong>
          {preview.map((m) => (
            <div key={m.from_class}>
              {m.to_class ? `Move ${m.students} students from ${m.from_name} to ${m.to_name}` : `Mark ${m.students} students in ${m.from_name} as leaving school`}
            </div>
          ))}
        </div>
      )}
      <div className="form-actions" style={{ marginTop: 12 }}>
        {!preview ? (
          <button type="button" onClick={() => run(false)} disabled={busy || moves.length === 0}>Preview</button>
        ) : (
          <>
            <button type="button" className="danger-solid" onClick={() => run(true)} disabled={busy}>
              {busy ? 'Moving…' : 'Confirm and move students'}
            </button>
            <button type="button" className="secondary" onClick={() => setPreview(null)}>Change plan</button>
          </>
        )}
      </div>
    </div>
  )
}

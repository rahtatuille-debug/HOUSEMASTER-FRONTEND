import { useEffect, useRef, useState } from 'react'
import { useVocab } from '../levels.js'
import { formatDate } from '../format.js'
import { api } from '../api.js'
import { loadDraft, saveDraft } from '../drafts.js'

const STATUSES = [
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'late', label: 'Late' },
  { key: 'excused', label: 'Excused' },
]

function todayLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The changes a teacher made that aren't saved yet, kept on the phone so a
// weak signal or a closed app doesn't lose a register (drafts.js). Only what
// differs from what's saved (or, for a new register, from "Present").
function unsavedChanges(marks) {
  const out = {}
  for (const [id, m] of Object.entries(marks)) {
    const changed = m.id === null
      ? m.status !== 'present' || m.notes !== ''
      : m.status !== m.savedStatus || m.notes !== m.savedNotes
    if (changed) out[id] = { status: m.status, notes: m.notes }
  }
  return out
}

// Daily class register. Pick a class and a date; everyone starts as
// Present, tap to change anyone who isn't, then save once. Teachers only
// see the classes they're assigned to (the API enforces this too).
export default function Attendance({ me }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(todayLocal())
  const [students, setStudents] = useState([])
  // studentId -> { id (existing record id or null), status, notes, savedStatus, savedNotes }
  const [marks, setMarks] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState(null) // { student, records }
  const draftName = `attendance:${classId}:${date}`
  const loadedFor = useRef(null) // the register whose marks are on screen

  useEffect(() => {
    if (loadedFor.current !== draftName) return
    const changes = unsavedChanges(marks)
    saveDraft(me?.id, draftName, Object.keys(changes).length ? changes : null)
  }, [me?.id, draftName, marks])

  useEffect(() => {
    api.schoolClasses
      .list()
      .then((all) => {
        const mine = isAdmin
          ? all
          : all.filter((c) => (me?.assignments || []).some((a) => a.school_class === c.id))
        setClasses(mine)
        if (mine.length === 1) setClassId(String(mine[0].id))
      })
      .catch((err) => setError(err.message))
  }, [isAdmin, me])

  useEffect(() => {
    if (!classId || !date) return
    let cancelled = false
    async function load() {
      loadedFor.current = null
      setLoading(true)
      setError('')
      setNotice('')
      setHistory(null)
      try {
        const [list, records] = await Promise.all([
          api.students.list({ school_class: classId, is_active: true }),
          api.attendance.list({ date }),
        ])
        if (cancelled) return
        const byStudent = Object.fromEntries(records.map((r) => [r.student, r]))
        const next = {}
        for (const s of list) {
          const r = byStudent[s.id]
          next[s.id] = r
            ? { id: r.id, status: r.status, notes: r.notes || '', savedStatus: r.status, savedNotes: r.notes || '' }
            : { id: null, status: 'present', notes: '', savedStatus: null, savedNotes: '' }
        }
        const draft = loadDraft(me?.id, `attendance:${classId}:${date}`) || {}
        let restored = 0
        for (const [id, change] of Object.entries(draft)) {
          if (next[id]) {
            next[id] = { ...next[id], status: change.status, notes: change.notes }
            restored += 1
          }
        }
        setStudents(list)
        setMarks(next)
        loadedFor.current = `attendance:${classId}:${date}`
        if (restored) {
          setNotice(`Restored ${restored} unsaved change${restored === 1 ? '' : 's'} from earlier. Tap Save register to save ${restored === 1 ? 'it' : 'them'}.`)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [classId, date, me?.id])

  function setMark(studentId, change) {
    setMarks((m) => ({ ...m, [studentId]: { ...m[studentId], ...change } }))
  }

  function markAll(status) {
    setMarks((m) => Object.fromEntries(Object.entries(m).map(([id, mark]) => [id, { ...mark, status }])))
  }

  const alreadyTaken = students.some((s) => marks[s.id]?.id)
  const unsaved = students.filter((s) => {
    const m = marks[s.id]
    return m && (m.id === null || m.status !== m.savedStatus || m.notes !== m.savedNotes)
  })

  // Each student is saved separately, so on a weak signal some can save and
  // some not. The saved ones are kept, the rest stay on screen to save again.
  // A save whose answer was lost may still have reached the server, so after
  // any failure the screen checks what the server has before offering to
  // save again (saving a student twice for one day would be refused).
  async function save() {
    setSaving(true)
    setError('')
    setNotice('')
    const toSave = unsaved
    const settled = await Promise.allSettled(
      toSave.map((s) => {
        const m = marks[s.id]
        const body = { status: m.status, notes: m.notes.trim() }
        return m.id
          ? api.attendance.update(m.id, body)
          : api.attendance.create({ ...body, student: s.id, date })
      })
    )
    const saved = {}
    for (const r of settled) {
      if (r.status === 'fulfilled') saved[r.value.student] = r.value
    }
    const failed = settled.filter((r) => r.status === 'rejected')
    if (failed.length) {
      try {
        const records = await api.attendance.list({ date })
        const ids = new Set(toSave.map((s) => s.id))
        for (const r of records) {
          if (ids.has(r.student) && !saved[r.student]) saved[r.student] = r
        }
      } catch {
        // still no signal: the failed ones simply stay unsaved
      }
    }
    // What the server now holds for each student; what the teacher chose
    // stays on screen, so anything the server doesn't have yet is still
    // "to save".
    const next = { ...marks }
    for (const r of Object.values(saved)) {
      next[r.student] = { ...next[r.student], id: r.id, savedStatus: r.status, savedNotes: r.notes || '' }
    }
    setMarks((current) => {
      const merged = { ...current }
      for (const r of Object.values(saved)) {
        merged[r.student] = { ...current[r.student], id: r.id, savedStatus: r.status, savedNotes: r.notes || '' }
      }
      return merged
    })
    const remaining = toSave.filter((s) => {
      const m = next[s.id]
      return m.id === null || m.status !== m.savedStatus || m.notes.trim() !== m.savedNotes
    }).length
    const done = toSave.length - remaining
    if (remaining === 0) {
      setNotice(`Register saved for ${toSave.length} student${toSave.length === 1 ? '' : 's'}.`)
    } else {
      setError(
        `Saved ${done} of ${toSave.length}. ${remaining} still to save: ${failed[0]?.reason?.message || 'the connection dropped.'} ` +
        'They’re kept here: tap Save register again when you have a signal.'
      )
    }
    setSaving(false)
  }

  async function showHistory(student) {
    setError('')
    try {
      const records = await api.attendance.list({ student: student.id })
      records.sort((a, b) => (a.date < b.date ? 1 : -1))
      setHistory({ student, records })
    } catch (err) {
      setError(err.message)
    }
  }

  const counts = STATUSES.map((st) => ({
    ...st,
    n: students.filter((s) => marks[s.id]?.status === st.key).length,
  }))

  return (
    <div>
      <div className="panel-header">
        <h2>Attendance</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <div className="card">
        <div className="form-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="att-class">{words.class}</label>
            <select id="att-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Select…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="att-date">Date</label>
            <input id="att-date" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        {!isAdmin && classes.length === 0 && (
          <p className="hint">You aren't assigned to any classes yet. Ask an admin to assign you.</p>
        )}
      </div>

      {classId && (
        loading ? (
          <p className="text-muted">Loading…</p>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <h3>No active students in this class</h3>
          </div>
        ) : (
          <div className="card">
            <div className="panel-header" style={{ marginBottom: 8 }}>
              <h3 style={{ fontSize: 15 }}>
                {alreadyTaken ? 'Register taken' : 'Register not taken yet'}
              </h3>
              <button type="button" className="secondary" onClick={() => markAll('present')}>
                Mark everyone present
              </button>
            </div>
            <p className="register-summary">
              {counts.map((c) => (
                <span key={c.key}>
                  {c.label}: <strong>{c.n}</strong>
                </span>
              ))}
            </p>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const m = marks[s.id]
                  if (!m) return null
                  return (
                    <tr key={s.id}>
                      <td>
                        <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0, textAlign: 'left' }} onClick={() => showHistory(s)}>
                          {s.first_name} {s.last_name}
                        </button>
                      </td>
                      <td>
                        <div className="register-status" role="group" aria-label={`Status for ${s.first_name} ${s.last_name}`}>
                          {STATUSES.map((st) => (
                            <button
                              key={st.key}
                              type="button"
                              className={`secondary${m.status === st.key ? ` selected-${st.key}` : ''}`}
                              aria-pressed={m.status === st.key}
                              onClick={() => setMark(s.id, { status: st.key })}
                            >
                              {st.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        <input
                          value={m.notes}
                          maxLength={255}
                          placeholder="optional"
                          aria-label={`Note for ${s.first_name} ${s.last_name}`}
                          onChange={(e) => setMark(s.id, { notes: e.target.value })}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="form-actions" style={{ marginTop: 14 }}>
              <button type="button" onClick={save} disabled={saving || unsaved.length === 0}>
                {saving ? 'Saving…' : unsaved.length === 0 ? 'All saved' : `Save register (${unsaved.length})`}
              </button>
            </div>
          </div>
        )
      )}

      {history && (
        <div className="card">
          <div className="panel-header" style={{ marginBottom: 8 }}>
            <h3 style={{ fontSize: 15 }}>
              {history.student.first_name} {history.student.last_name} — attendance history
            </h3>
            <button type="button" className="secondary" onClick={() => setHistory(null)}>
              Close
            </button>
          </div>
          {history.records.length === 0 ? (
            <p className="text-muted">No attendance recorded yet.</p>
          ) : (
            <>
              <p className="register-summary">
                {STATUSES.map((st) => (
                  <span key={st.key}>
                    {st.label}: <strong>{history.records.filter((r) => r.status === st.key).length}</strong>
                  </span>
                ))}
                <span>
                  Attendance:{' '}
                  <strong>
                    {Math.round(
                      (100 * history.records.filter((r) => r.status === 'present' || r.status === 'late').length) /
                        history.records.length
                    )}
                    %
                  </strong>
                </span>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {history.records.map((r) => (
                    <tr key={r.id}>
                      <td>{formatDate(r.date)}</td>
                      <td>
                        <span className={`badge ${r.status}`}>{r.status}</span>
                      </td>
                      <td className="text-muted">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
    </div>
  )
}

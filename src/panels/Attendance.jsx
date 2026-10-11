import { useCallback, useEffect, useState } from 'react'
import { classesFor, perms } from '../permissions.js'
import { useVocab } from '../levels.js'
import { formatDate } from '../format.js'
import { api } from '../api.js'

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
  // studentId -> what a parent reported for this day (absences), shown on the register.
  const [reported, setReported] = useState({})
  // Every class's register for the date, for the class tabs and the overview.
  const [summary, setSummary] = useState(null)
  const loadSummary = useCallback(() => {
    // An older server has no summary: the tabs then show the classes without numbers.
    api.attendance.summary(date).then((d) => setSummary(Array.isArray(d?.classes) ? d : null)).catch(() => setSummary(null))
  }, [date])
  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => {
    api.schoolClasses
      .list()
      .then((all) => {
        const mine = classesFor(me, all, 'attendance')
        setClasses(mine)
        if (mine.length === 1) setClassId(String(mine[0].id))
      })
      .catch((err) => setError(err.message))
  }, [isAdmin, me])

  useEffect(() => {
    if (!classId || !date) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError('')
      setNotice('')
      setHistory(null)
      try {
        const [list, records, reports] = await Promise.all([
          api.students.list({ school_class: classId, is_active: true }),
          api.attendance.list({ date }),
          // An older server has no absence reports: the register still works.
          api.absenceReports.list({ date, school_class: classId }).catch(() => []),
        ])
        if (cancelled) return
        const byStudent = Object.fromEntries(records.map((r) => [r.student, r]))
        const parentSaid = Object.fromEntries((Array.isArray(reports) ? reports : []).map((r) => [r.student, r]))
        const next = {}
        for (const s of list) {
          const r = byStudent[s.id]
          const said = parentSaid[s.id]
          next[s.id] = r
            ? { id: r.id, status: r.status, notes: r.notes || '', savedStatus: r.status, savedNotes: r.notes || '' }
            // A parent said they'd be away: start them as excused (the teacher can change it).
            : said ? { id: null, status: 'excused', notes: `Parent: ${said.reason_label}`, savedStatus: null, savedNotes: '' }
              : { id: null, status: 'present', notes: '', savedStatus: null, savedNotes: '' }
        }
        setReported(parentSaid)
        setStudents(list)
        setMarks(next)
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
  }, [classId, date])

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
    loadSummary()
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

      <div className="card att-picker">
        <div className="att-picker-head">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="att-date">Date</label>
            <input id="att-date" type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
          </div>
          {summary && summary.classes.length > 0 && (
            <p className="att-totals" aria-label="Whole school">
              <span>Present <strong>{summary.totals.present + summary.totals.late}</strong></span>
              <span>Absent <strong>{summary.totals.absent}</strong></span>
              <span>Marked <strong>{summary.totals.marked} / {summary.totals.students}</strong></span>
              {summary.totals.not_taken > 0 && <span className="att-alert">{summary.totals.not_taken} register{summary.totals.not_taken === 1 ? '' : 's'} not taken</span>}
            </p>
          )}
        </div>
        <div className="att-class-tabs" role="tablist" aria-label={words.classes}>
          <button type="button" role="tab" aria-selected={!classId} className={!classId ? 'active' : ''} onClick={() => setClassId('')}>
            <strong>All {words.classes.toLowerCase()}</strong>
          </button>
          {classes.map((c) => {
            const row = summary?.classes.find((r) => r.id === c.id)
            return (
              <button key={c.id} type="button" role="tab" aria-selected={String(c.id) === classId}
                aria-label={!row ? c.name : row.marked === 0 ? `${c.name}: register not taken` : `${c.name}: ${row.present + row.late} present, ${row.absent} absent`}
                className={`${String(c.id) === classId ? 'active' : ''}${row && row.marked === 0 ? ' not-taken' : ''}`}
                onClick={() => setClassId(String(c.id))}>
                <strong>{c.name}</strong>
                {row && (row.marked === 0
                  ? <span className="att-tab-counts">Not taken</span>
                  : <span className="att-tab-counts"><span className="att-present">{row.present + row.late} in</span> · <span className="att-absent">{row.absent} out</span></span>)}
              </button>
            )
          })}
        </div>
        {!isAdmin && classes.length === 0 && (
          <p className="hint">You aren't assigned to any classes yet. Ask an admin to assign you.</p>
        )}
      </div>

      {!classId && summary && summary.classes.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <table className="responsive-table att-overview">
            <thead>
              <tr><th>{words.class}</th><th>Present</th><th>Late</th><th>Absent</th><th>Marked</th><th></th></tr>
            </thead>
            <tbody>
              {summary.classes.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.name}</strong> <span className="text-muted">· {r.year_group}</span></td>
                  <td>{r.marked ? r.present : '—'}</td>
                  <td>{r.marked ? r.late : '—'}</td>
                  <td>{r.marked ? <span className={r.absent ? 'att-absent' : ''}>{r.absent}</span> : '—'}</td>
                  <td>{r.marked === 0 ? <span className="badge rejected">Not taken</span> : `${r.marked} / ${r.students}`}</td>
                  <td><button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setClassId(String(r.id))}>
                    {r.marked === 0 ? 'Take register' : 'Open'}
                  </button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
                        {reported[s.id] && (
                          <div className="hint register-reported" style={{ margin: '2px 0 0' }}>
                            <span className="badge excused">Parent: {reported[s.id].reason_label}</span>
                            {reported[s.id].details && <span> {reported[s.id].details}</span>}
                          </div>
                        )}
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

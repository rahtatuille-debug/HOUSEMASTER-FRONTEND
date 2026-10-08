import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import StudentSelect from './StudentSelect.jsx'

// The same list the server accepts (discipline.models.Merit).
export const MERIT_CATEGORIES = [
  ['work', 'Excellent work'], ['effort', 'Effort'], ['improvement', 'Big improvement'], ['kindness', 'Kindness and respect'],
  ['helping', 'Helping others'], ['leadership', 'Leadership'], ['service', 'Service to the school'], ['sport', 'Sport'],
  ['arts', 'Music, drama or art'], ['attendance', 'Attendance and punctuality'], ['other', 'Other'],
]
const POINTS = [1, 2, 3, 4, 5]
const PERIODS = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last year'], ['', 'All time']]

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d) }
const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const fullName = (s) => `${s.first_name} ${s.last_name}`

// Who gets it: add students one by one or a whole class, shown as chips.
function Recipients({ students, classes, chosen, onChange }) {
  const [pick, setPick] = useState('')
  const byId = new Map(students.map((s) => [String(s.id), s]))
  const add = (ids) => onChange([...new Set([...chosen, ...ids.map(String)])])
  return (
    <div className="span-all merit-who">
      <div className="merit-who-pickers">
        <StudentSelect id="merit-student" label="Add a student" students={students.filter((s) => !chosen.includes(String(s.id)))}
          value={pick} onChange={(v) => { if (v) { add([v]); setPick('') } }} emptyLabel="Choose…" />
        {classes.length > 0 && (
          <label>Or a whole class
            <select value="" onChange={(e) => e.target.value && add(students.filter((s) => String(s.school_class) === e.target.value).map((s) => s.id))}>
              <option value="">Choose…</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.count})</option>)}
            </select>
          </label>
        )}
      </div>
      {chosen.length > 0 ? (
        <>
          <p className="hint" style={{ margin: '6px 0 4px' }}>{plural(chosen.length, 'student')} chosen
            {chosen.length > 1 && <> · <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => onChange([])}>Clear</button></>}
          </p>
          <ul className="chip-list" aria-label="Students getting the merit" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {chosen.map((id) => byId.get(id) && (
              <li key={id} className="chip">{fullName(byId.get(id))}
                <button type="button" className="secondary" aria-label={`Remove ${fullName(byId.get(id))}`}
                  onClick={() => onChange(chosen.filter((c) => c !== id))}>×</button>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="hint" style={{ margin: '6px 0 0' }}>Nobody chosen yet.</p>}
    </div>
  )
}

function MeritForm({ initial, students, classes, onSubmit, onCancel, submitLabel }) {
  const editing = Boolean(initial?.id)
  const [form, setForm] = useState({ date: isoDay(new Date()), category: '', points: 1, reason: '', shared_with_parents: true,
    students: initial?.student && !editing ? [String(initial.student)] : [], ...(editing ? initial : {}) })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(form) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="tt-form-grid discipline-form merit-form">
      {!editing && <Recipients students={students} classes={classes} chosen={form.students} onChange={(ids) => setForm((f) => ({ ...f, students: ids }))} />}
      <label>What for
        <select value={form.category} onChange={set('category')} required>
          <option value="">Choose…</option>
          {MERIT_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Points
        <select value={form.points} onChange={set('points')}>
          {POINTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>Date<input type="date" value={form.date} max={isoDay(new Date())} onChange={set('date')} required /></label>
      <label className="span-all">Reason (optional)
        <input value={form.reason} onChange={set('reason')} maxLength={500} placeholder="e.g. Led the group project brilliantly" />
      </label>
      <label className="span-all check-row">
        <input type="checkbox" checked={form.shared_with_parents} onChange={set('shared_with_parents')} />
        Parents can see it in the app (they aren&apos;t emailed).
      </label>
      <div className="tt-form-actions">
        <button type="submit" disabled={busy || (!editing && form.students.length === 0)} style={{ width: 'auto' }}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// One merit, as staff see it.
export function MeritCard({ merit: m, showStudent = true, actions }) {
  return (
    <li className="discipline-item">
      <div className="discipline-head">
        <span className="badge merit-points">+{m.points}</span>
        <strong>{m.category_label}</strong>
        {showStudent && <span>· {m.student_name}{m.class_name ? <span className="text-muted"> ({m.class_name})</span> : null}</span>}
        <span className="text-muted">· {formatDate(m.date)}</span>
      </div>
      {m.reason && <p style={{ margin: '4px 0' }}>{m.reason}</p>}
      <div className="hint" style={{ margin: 0 }}>
        {[m.awarded_by_name && `Given by ${m.awarded_by_name}`, m.shared_with_parents ? 'Parents can see it' : 'Staff only'].filter(Boolean).join(' · ')}
      </div>
      {actions && <div className="support-actions" style={{ marginTop: 6 }}>{actions}</div>}
    </li>
  )
}

// Merits: rewards, so a student's record isn't only incidents.
export default function Merits({ students, classNames, navParams }) {
  const [merits, setMerits] = useState(null)
  const [summary, setSummary] = useState(null)
  const [filters, setFilters] = useState({ student: navParams?.studentId ? String(navParams.studentId) : '', school_class: '', category: '', period: '30' })
  const [open, setOpen] = useState(null) // "new" or "edit-<id>"
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const params = useMemo(() => {
    const p = {}
    for (const key of ['student', 'school_class', 'category']) if (filters[key]) p[key] = filters[key]
    if (filters.period) p.from = daysAgo(Number(filters.period))
    return p
  }, [filters])
  const load = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([api.discipline.merits.list(params), api.discipline.merits.summary(params)])
      setMerits(Array.isArray(list) ? list : [])
      setSummary(sum || null)
    } catch (err) {
      setError(err.message)
    }
  }, [params])
  useEffect(() => { load() }, [load])

  // Classes that have students this person can see, for "a whole class" and the filter.
  const classes = useMemo(() => {
    const counts = new Map()
    for (const s of students) if (s.school_class && s.is_active !== false) counts.set(s.school_class, (counts.get(s.school_class) || 0) + 1)
    return [...counts].filter(([id]) => classNames[id]).map(([id, count]) => ({ id, count, name: classNames[id] })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }, [students, classNames])

  async function run(fn, message) {
    setError('')
    setNotice('')
    try {
      const result = await fn()
      setOpen(null)
      setNotice(typeof message === 'function' ? message(result) : message)
      await load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  const body = (form) => ({ category: form.category, points: Number(form.points), date: form.date, reason: form.reason, shared_with_parents: form.shared_with_parents })
  const give = (form) => run(() => api.discipline.merits.create({ ...body(form), students: form.students.map(Number) }),
    (r) => (r.awarded === 1 ? `Merit given to ${r.merits[0].student_name}.` : `Merit given to ${r.awarded} students.`))
  const save = (m) => (form) => run(() => api.discipline.merits.update(m.id, body(form)), 'Saved.')
  const remove = (m) => {
    if (!window.confirm(`Remove this merit for ${m.student_name}?`)) return
    run(() => api.discipline.merits.remove(m.id), 'Removed.')
  }
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }))
  const active = students.filter((s) => s.is_active !== false)

  return (
    <div>
      <div className="panel-header">
        <div>
          <p className="text-muted" style={{ margin: 0 }}>Merits reward students for good work and good behaviour.</p>
        </div>
        <button type="button" style={{ width: 'auto' }} onClick={() => setOpen('new')}>Give a merit</button>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {open === 'new' && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Give a merit</h3>
          <MeritForm students={active} classes={classes} submitLabel="Give merit"
            initial={filters.student ? { student: filters.student } : undefined} onSubmit={give} onCancel={() => setOpen(null)} />
        </div>
      )}

      <div className="card discipline-filters">
        <StudentSelect id="merit-filter-student" label="Student" students={students} value={filters.student}
          onChange={setFilter('student')} emptyLabel="All students" />
        <label>Class
          <select value={filters.school_class} onChange={(e) => setFilter('school_class')(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>What for
          <select value={filters.category} onChange={(e) => setFilter('category')(e.target.value)}>
            <option value="">Anything</option>
            {MERIT_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>When
          <select value={filters.period} onChange={(e) => setFilter('period')(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {summary && summary.merits > 0 && (
        <div className="merit-boards">
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 8 }}>Most points</h3>
            <ol className="merit-board">
              {summary.top_students.map((s) => (
                <li key={s.id}><span>{s.name}{s.class_name && <span className="text-muted"> · {s.class_name}</span>}</span><strong>{s.points}</strong></li>
              ))}
            </ol>
          </div>
          {summary.classes.length > 0 && (
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Points by class</h3>
              <ol className="merit-board">
                {summary.classes.map((c) => (
                  <li key={c.id}><span>{c.name} <span className="text-muted">· {plural(c.students, 'student')}</span></span><strong>{c.points}</strong></li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {merits === null ? <p className="text-muted">Loading…</p> : (
        <div className="card">
          <p className="discipline-summary">
            <strong>{summary?.points ?? 0}</strong> points · <strong>{merits.length}</strong> merit{merits.length === 1 ? '' : 's'} · <strong>{summary?.students ?? 0}</strong> student{summary?.students === 1 ? '' : 's'}
          </p>
          {merits.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No merits match.</p> : (
            <ul className="support-list">
              {merits.map((m) => open === `edit-${m.id}` ? (
                <li key={m.id}><MeritForm initial={m} students={active} classes={classes} submitLabel="Save changes" onSubmit={save(m)} onCancel={() => setOpen(null)} /></li>
              ) : (
                <MeritCard key={m.id} merit={m} actions={m.can_edit && <>
                  <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(`edit-${m.id}`)}
                    aria-label={`Edit the merit for ${m.student_name}`}>Edit</button>
                  <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => remove(m)}
                    aria-label={`Remove the merit for ${m.student_name}`}>Remove</button>
                </>} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

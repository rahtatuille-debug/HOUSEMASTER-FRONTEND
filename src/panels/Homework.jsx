import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'

export const STATUSES = [['handed_in', 'Handed in'], ['late', 'Late'], ['missing', 'Missing'], ['excused', 'Excused']]
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
const asList = (d) => (Array.isArray(d) ? d : d?.results || [])

export function dueText(due, today = isoDay(new Date())) {
  if (due === today) return 'Due today'
  const days = Math.round((new Date(`${due}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86400000)
  if (days === 1) return 'Due tomorrow'
  if (days < 0) return `Was due ${formatDate(due, { day: 'numeric', month: 'short' })}`
  return `Due ${formatDate(due, { weekday: 'short', day: 'numeric', month: 'short' })}`
}

function HomeworkForm({ initial, choices, onSubmit, onCancel }) {
  const editing = Boolean(initial?.id)
  const first = choices[0]
  const [form, setForm] = useState({ pair: first ? `${first.school_class}:${first.subject}` : '', title: '', instructions: '', link: '',
    due_date: isoDay(new Date(Date.now() + 2 * 86400000)), out_of: '', ...initial, out_of: initial?.out_of ?? '' })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const [school_class, subject] = form.pair.split(':').map(Number)
    const body = { title: form.title, instructions: form.instructions, link: form.link.trim(), due_date: form.due_date,
      out_of: form.out_of === '' ? null : Number(form.out_of) }
    try { await onSubmit(editing ? body : { ...body, school_class, subject }) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="tt-form-grid discipline-form">
      {!editing && (
        <label className="span-all">Class and subject
          <select value={form.pair} onChange={set('pair')} required>
            {choices.map((c) => <option key={`${c.school_class}:${c.subject}`} value={`${c.school_class}:${c.subject}`}>{c.class_name} · {c.subject_name}</option>)}
          </select>
        </label>
      )}
      <label className="span-all">Title<input value={form.title} onChange={set('title')} maxLength={150} required placeholder="e.g. Fractions worksheet" /></label>
      <label className="span-all">Instructions
        <textarea rows={3} value={form.instructions} onChange={set('instructions')} maxLength={4000} placeholder="What to do, and how to hand it in." />
      </label>
      <label className="span-all">Link (optional)<input type="url" value={form.link} onChange={set('link')} maxLength={500} placeholder="https://… a worksheet, video or page" /></label>
      <label>Due<input type="date" value={form.due_date} onChange={set('due_date')} required /></label>
      <label>Marked out of (optional)<input type="number" min={1} max={1000} value={form.out_of} onChange={set('out_of')} /></label>
      <div className="tt-form-actions">
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : editing ? 'Save' : 'Set homework'}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function Record({ assignment, onBack, onSaved }) {
  const [data, setData] = useState(null)
  const [rows, setRows] = useState({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const d = await api.homework.records(assignment.id)
      setData(d)
      setRows(Object.fromEntries(d.students.map((s) => [s.student, { status: s.status || '', mark: s.mark ?? '', comment: s.comment || '' }])))
    } catch (err) {
      setError(err.message)
    }
  }, [assignment.id])
  useEffect(() => { load() }, [load])
  const set = (sid, key, value) => setRows({ ...rows, [sid]: { ...rows[sid], [key]: value } })
  async function save() {
    setBusy(true)
    setError('')
    try {
      await api.homework.saveRecords(assignment.id, { records: Object.entries(rows).map(([student, r]) => ({ student: Number(student), status: r.status, mark: r.mark === '' ? null : r.mark, comment: r.comment })) })
      onSaved(`Saved how ${data.students.length} student${data.students.length === 1 ? '' : 's'} did on ${assignment.title}.`)
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  const a = data?.assignment || assignment
  return (
    <div>
      <button type="button" className="link-button back-button" style={{ width: 'auto' }} onClick={onBack}>← All homework</button>
      <div className="panel-header">
        <div>
          <h2>{a.title}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>{a.class_name} · {a.subject_name} · {dueText(a.due_date)}{a.out_of ? ` · out of ${a.out_of}` : ''}</p>
        </div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!data ? <p className="text-muted">Loading…</p> : (
        <div className="card">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
            <button type="button" className="secondary" style={{ width: 'auto' }}
              onClick={() => setRows(Object.fromEntries(Object.entries(rows).map(([k, r]) => [k, { ...r, status: r.status || 'handed_in' }])))}>Everyone else handed in</button>
          </div>
          <ul className="hw-records">
            {data.students.map((s) => (
              <li key={s.student}>
                <div className="hw-who">
                  <strong>{s.name}</strong>
                  {s.done_at && <span className="badge finalized">Marked done {formatDate(s.done_at, { day: 'numeric', month: 'short' })}</span>}
                  {s.answer && <span className="hw-answer">{s.answer}</span>}
                </div>
                <span className="club-marks" role="radiogroup" aria-label={`How ${s.name} did`}>
                  {STATUSES.map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={rows[s.student]?.status === v}
                      className={rows[s.student]?.status === v ? `hw-${v} active` : 'secondary'} style={{ width: 'auto' }}
                      onClick={() => set(s.student, 'status', rows[s.student]?.status === v ? '' : v)}>{l}</button>
                  ))}
                </span>
                {a.out_of ? (
                  <input className="hw-mark" type="number" min={0} max={a.out_of} step="0.5" aria-label={`Mark for ${s.name}`} placeholder={`/ ${a.out_of}`}
                    value={rows[s.student]?.mark ?? ''} onChange={(e) => set(s.student, 'mark', e.target.value)} />
                ) : null}
                <input className="hw-comment" aria-label={`Comment for ${s.name}`} placeholder="Comment (student and parents see it)" maxLength={1000}
                  value={rows[s.student]?.comment ?? ''} onChange={(e) => set(s.student, 'comment', e.target.value)} />
              </li>
            ))}
          </ul>
          <button type="button" style={{ width: 'auto', marginTop: 10 }} disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      )}
    </div>
  )
}

function summary(c) {
  if (!c) return ''
  const parts = [`${c.students - c.not_recorded} of ${c.students} recorded`]
  if (c.missing) parts.push(`${c.missing} missing`)
  if (c.late) parts.push(`${c.late} late`)
  if (c.done_by_student) parts.push(`${c.done_by_student} marked done by students`)
  return parts.join(' · ')
}

// Homework: teachers set it for a class and subject and record how each student did.
export default function Homework({ navParams }) {
  const [list, setList] = useState(null)
  const [choices, setChoices] = useState([])
  const [filters, setFilters] = useState({ when: 'upcoming', pair: '', mine: false })
  const [open, setOpen] = useState(navParams?.homeworkId ? { record: navParams.homeworkId } : null) // "new", {edit}, {record}
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const params = useMemo(() => {
    const p = {}
    if (filters.when) p.when = filters.when
    if (filters.pair) { const [c, s] = filters.pair.split(':'); p.school_class = c; p.subject = s }
    if (filters.mine) p.mine = 1
    return p
  }, [filters])
  const load = useCallback(async () => {
    try { setList(asList(await api.homework.list(params))) } catch (err) { setError(err.message) }
  }, [params])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.homework.choices().then((c) => setChoices(asList(c))).catch(() => setChoices([])) }, [])

  async function act(fn, message) {
    setError('')
    try {
      await fn()
      setOpen(null)
      setNotice(message)
      await load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  const remove = (a) => window.confirm(`Remove "${a.title}" for ${a.class_name}? What students handed in is removed too.`) &&
    act(() => api.homework.remove(a.id), `Removed ${a.title}.`)

  if (open?.record) {
    const a = (list || []).find((x) => x.id === open.record) || { id: open.record, title: 'Homework', due_date: isoDay(new Date()) }
    return <Record assignment={a} onBack={() => setOpen(null)} onSaved={(m) => { setOpen(null); setNotice(m); load() }} />
  }
  const today = isoDay(new Date())
  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Homework</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Set work for your classes and record how each student did. Students and parents see it.</p>
        </div>
        {choices.length > 0 && open !== 'new' && <button type="button" style={{ width: 'auto' }} onClick={() => setOpen('new')}>Set homework</button>}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {open === 'new' && (
        <div className="card"><h3 style={{ fontSize: 15, marginBottom: 8 }}>Set homework</h3>
          <HomeworkForm choices={choices} onSubmit={(body) => act(() => api.homework.create(body), `Set ${body.title}.`)} onCancel={() => setOpen(null)} /></div>
      )}
      <div className="card discipline-filters">
        <label>When
          <select value={filters.when} onChange={(e) => setFilters({ ...filters, when: e.target.value })}>
            <option value="upcoming">Coming up</option><option value="past">Past</option><option value="">All</option>
          </select>
        </label>
        <label>Class and subject
          <select value={filters.pair} onChange={(e) => setFilters({ ...filters, pair: e.target.value })}>
            <option value="">All</option>
            {choices.map((c) => <option key={`${c.school_class}:${c.subject}`} value={`${c.school_class}:${c.subject}`}>{c.class_name} · {c.subject_name}</option>)}
          </select>
        </label>
        <label className="check-row" style={{ alignSelf: 'center' }}>
          <input type="checkbox" checked={filters.mine} onChange={(e) => setFilters({ ...filters, mine: e.target.checked })} style={{ width: 'auto' }} /> Only homework I set
        </label>
      </div>
      {list === null ? <p className="text-muted">Loading…</p> : list.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>No homework {filters.when === 'upcoming' ? 'coming up' : 'here'}.</p></div>
      ) : (
        <ul className="hw-list">
          {list.map((a) => open?.edit === a.id ? (
            <li key={a.id} className="card"><HomeworkForm initial={a} choices={choices} onSubmit={(body) => act(() => api.homework.update(a.id, body), 'Saved.')} onCancel={() => setOpen(null)} /></li>
          ) : (
            <li key={a.id} className="card hw-card">
              <div className="hw-card-head">
                <span className="club-kind">{a.subject_name} · {a.class_name}</span>
                <span className={`badge ${a.due_date < today ? 'draft' : a.due_date === today ? 'pending' : 'finalized'}`}>{dueText(a.due_date, today)}</span>
              </div>
              <strong className="hw-title">{a.title}</strong>
              {a.instructions && <p className="hw-instructions">{a.instructions}</p>}
              {a.link && <a href={a.link} target="_blank" rel="noopener noreferrer" className="hw-link">{a.link}</a>}
              <span className="hint" style={{ margin: 0 }}>{[`Set by ${a.set_by_name || 'staff'}`, summary(a.counts)].filter(Boolean).join(' · ')}</span>
              {a.can_edit && (
                <div className="support-actions" style={{ marginTop: 6 }}>
                  <button type="button" style={{ width: 'auto' }} onClick={() => setOpen({ record: a.id })} aria-label={`Record ${a.title} for ${a.class_name}`}>Record</button>
                  <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen({ edit: a.id })}>Edit</button>
                  <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => remove(a)}>Remove</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

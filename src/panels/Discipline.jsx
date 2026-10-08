import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import StudentSelect from './StudentSelect.jsx'

// The same lists the server accepts (discipline.models.DisciplineIncident).
export const CATEGORIES = [
  ['late', 'Late'], ['homework', 'Homework not done'], ['disruption', 'Disrupting lessons'], ['uniform', 'Uniform'],
  ['phone', 'Phone or device'], ['disrespect', 'Disrespect'], ['dishonesty', 'Cheating or dishonesty'],
  ['truancy', 'Skipping lessons'], ['bullying', 'Bullying'], ['fighting', 'Fighting'], ['damage', 'Damage to property'],
  ['substances', 'Alcohol, drugs or smoking'], ['other', 'Other'],
]
export const SEVERITIES = [['minor', 'Minor'], ['moderate', 'Moderate'], ['serious', 'Serious']]
export const ACTIONS = [
  ['none', 'No action yet'], ['warning', 'Warning'], ['detention', 'Detention'], ['community', 'Community work'],
  ['meeting', 'Meeting with parents'], ['suspension', 'Suspension'], ['exclusion', 'Exclusion'], ['other', 'Other'],
]
export const SEVERITY_BADGE = { minor: 'draft', moderate: 'pending', serious: 'rejected' }
const PERIODS = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['365', 'Last year'], ['', 'All time']]

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return isoDay(d) }
const fieldError = (err) => {
  const first = Object.values(err.data || {}).flat().find((v) => typeof v === 'string')
  return first || err.message
}
const BLANK = { student: '', date: '', category: '', severity: 'minor', description: '', action: 'none',
  action_detail: '', staff_notes: '', shared_with_parents: false }

function IncidentForm({ initial, students, onSubmit, onCancel, submitLabel }) {
  const [form, setForm] = useState({ ...BLANK, date: isoDay(new Date()), ...initial })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try { await onSubmit(form) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="tt-form-grid discipline-form">
      {students && (
        <StudentSelect id="disc-student" label="Student" students={students} value={form.student}
          onChange={(v) => setForm((f) => ({ ...f, student: v }))} emptyLabel="Choose…" required />
      )}
      <label>Date<input type="date" value={form.date} max={isoDay(new Date())} onChange={set('date')} required /></label>
      <label>What kind
        <select value={form.category} onChange={set('category')} required>
          <option value="">Choose…</option>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>How serious
        <select value={form.severity} onChange={set('severity')}>
          {SEVERITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="span-all">What happened
        <textarea rows={3} value={form.description} onChange={set('description')} maxLength={4000} required
          placeholder="The facts: where, when, who was involved." />
      </label>
      <label>Action taken
        <select value={form.action} onChange={set('action')}>
          {ACTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Details of the action<input value={form.action_detail} onChange={set('action_detail')} maxLength={300}
        placeholder="e.g. Detention Friday 3pm" /></label>
      <label className="span-all">Staff notes (never shown to parents)
        <textarea rows={2} value={form.staff_notes} onChange={set('staff_notes')} maxLength={4000} />
      </label>
      <label className="span-all check-row">
        <input type="checkbox" checked={form.shared_with_parents} onChange={set('shared_with_parents')} />
        Share with parents. They get a short email and can read what happened and the action, not the staff notes.
      </label>
      <div className="tt-form-actions">
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// One record, as staff see it.
export function IncidentCard({ incident: i, showStudent = true, actions }) {
  return (
    <li className="discipline-item">
      <div className="discipline-head">
        <span className={`badge ${SEVERITY_BADGE[i.severity] || 'draft'}`}>{i.severity_label}</span>
        <strong>{i.category_label}</strong>
        {showStudent && <span>· {i.student_name}{i.class_name ? <span className="text-muted"> ({i.class_name})</span> : null}</span>}
        <span className="text-muted">· {formatDate(i.date)}</span>
      </div>
      <p style={{ margin: '4px 0' }}>{i.description}</p>
      <div className="hint" style={{ margin: 0 }}>
        {[i.action_label, i.action_detail, i.recorded_by_name && `Recorded by ${i.recorded_by_name}`,
          i.shared_with_parents ? 'Shared with parents' : 'Not shared with parents'].filter(Boolean).join(' · ')}
      </div>
      {i.staff_notes && <div className="discipline-notes"><span className="text-muted">Staff notes:</span> {i.staff_notes}</div>}
      {actions && <div className="support-actions" style={{ marginTop: 6 }}>{actions}</div>}
    </li>
  )
}

// Behaviour records. Staff record what happened and what was done; they
// choose whether parents see it. Teachers see their own classes.
export default function Discipline({ me, navParams }) {
  const isAdmin = me?.role === 'admin'
  const [incidents, setIncidents] = useState(null)
  const [students, setStudents] = useState([])
  const [filters, setFilters] = useState({ student: navParams?.studentId ? String(navParams.studentId) : '', category: '', severity: '', period: '90' })
  const [open, setOpen] = useState(null) // "new" or "edit-<id>"
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const params = {}
    for (const key of ['student', 'category', 'severity']) if (filters[key]) params[key] = filters[key]
    if (filters.period) params.from = daysAgo(Number(filters.period))
    try {
      setIncidents(await api.discipline.list(params))
    } catch (err) {
      setError(err.message)
    }
  }, [filters])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.students.list({ is_active: true }).then((s) => setStudents(Array.isArray(s) ? s : [])).catch(() => setStudents([]))
  }, [])

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
  const told = (r) => (r?.parents_emailed ? ` ${r.parents_emailed} parent${r.parents_emailed === 1 ? ' has' : 's have'} been emailed.` : '')
  const create = (form) => run(() => api.discipline.create({ ...form, student: Number(form.student) }), (r) => `Recorded for ${r.student_name}.${told(r)}`)
  const save = (i) => (form) => run(() => api.discipline.update(i.id, form), (r) => `Saved.${told(r)}`)
  const share = (i) => run(() => api.discipline.update(i.id, { shared_with_parents: true }), (r) => `Shared with ${i.student_name}'s parents.${told(r)}`)
  const remove = (i) => {
    if (!window.confirm(`Delete this record for ${i.student_name}? This can't be undone.`)) return
    run(() => api.discipline.remove(i.id), 'Deleted.')
  }
  const setFilter = (key) => (value) => setFilters((f) => ({ ...f, [key]: value }))

  const list = incidents || []
  const serious = list.filter((i) => i.severity === 'serious').length
  const people = new Set(list.map((i) => i.student)).size

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Behaviour</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Discipline records: what happened and what the school did.</p>
        </div>
        <button type="button" style={{ width: 'auto' }} onClick={() => setOpen('new')}>Record an incident</button>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {open === 'new' && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Record an incident</h3>
          <IncidentForm students={students.filter((s) => s.is_active !== false)} submitLabel="Save record"
            initial={filters.student ? { student: filters.student } : undefined}
            onSubmit={create} onCancel={() => setOpen(null)} />
        </div>
      )}

      <div className="card discipline-filters">
        <StudentSelect id="disc-filter-student" label="Student" students={students} value={filters.student}
          onChange={setFilter('student')} emptyLabel="All students" />
        <label>What kind
          <select value={filters.category} onChange={(e) => setFilter('category')(e.target.value)}>
            <option value="">All kinds</option>
            {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>How serious
          <select value={filters.severity} onChange={(e) => setFilter('severity')(e.target.value)}>
            <option value="">Any</option>
            {SEVERITIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>When
          <select value={filters.period} onChange={(e) => setFilter('period')(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
      </div>

      {incidents === null ? <p className="text-muted">Loading…</p> : (
        <div className="card">
          <p className="discipline-summary">
            <strong>{list.length}</strong> record{list.length === 1 ? '' : 's'} · <strong>{people}</strong> student{people === 1 ? '' : 's'}
            {serious > 0 && <> · <strong className="text-alert">{serious}</strong> serious</>}
          </p>
          {list.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No records match.</p> : (
            <ul className="support-list">
              {list.map((i) => open === `edit-${i.id}` ? (
                <li key={i.id}>
                  <IncidentForm initial={i} submitLabel="Save changes" onSubmit={save(i)} onCancel={() => setOpen(null)} />
                </li>
              ) : (
                <IncidentCard key={i.id} incident={i} actions={(i.can_edit) && <>
                  <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(`edit-${i.id}`)}
                    aria-label={`Edit the record for ${i.student_name}`}>Edit</button>
                  {!i.shared_with_parents && <button type="button" className="secondary" style={{ width: 'auto' }}
                    onClick={() => share(i)} aria-label={`Share the record for ${i.student_name} with parents`}>Share with parents</button>}
                  {isAdmin && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => remove(i)}
                    aria-label={`Delete the record for ${i.student_name}`}>Delete</button>}
                </>} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

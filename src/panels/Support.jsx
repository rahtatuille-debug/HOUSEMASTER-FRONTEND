import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import { useVocab } from '../levels.js'

const REASONS = [
  { code: 'low_average', label: 'Low average' },
  { code: 'big_drop', label: 'Average dropped' },
  { code: 'poor_attendance', label: 'Low attendance' },
]

const toldParents = (name) => (concern) => `${name} is marked as needing support. ${
  concern?.parents_emailed || concern?.parents_notified_at ? 'Their parents have been emailed and' : 'Their parents'} can see it in the app.`

const isoToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const reviewDue = (concern) => Boolean(concern?.review_date && concern.review_date <= isoToday())
const fieldError = (err) => {
  const data = err.data || {}
  const first = Object.values(data).flat().find((v) => typeof v === 'string')
  return first || err.message
}

// The note, support plan and review date; with `reasons`, the warning signs
// HouseMaster found, which the teacher can untick before confirming.
function ConcernForm({ initial, reasons, submitLabel, onSubmit, onCancel, children }) {
  const [form, setForm] = useState({
    note: initial?.note || '', support_plan: initial?.support_plan || '', review_date: initial?.review_date || '',
    reasons: (reasons || []).map((r) => r.code),
  })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const toggle = (code) => setForm({
    ...form, reasons: form.reasons.includes(code) ? form.reasons.filter((c) => c !== code) : [...form.reasons, code],
  })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ ...form, review_date: form.review_date || null })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="support-form">
      {children}
      {reasons?.length > 0 && (
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 8px' }}>
          <legend className="hint" style={{ marginBottom: 4 }}>Reasons (parents see these)</legend>
          {reasons.map((r) => (
            <label key={r.code} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontWeight: 400 }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.reasons.includes(r.code)} onChange={() => toggle(r.code)} />
              {r.label}
            </label>
          ))}
        </fieldset>
      )}
      <label>
        Note for parents and staff
        <textarea rows={2} value={form.note} onChange={set('note')} placeholder="What you have noticed, in a sentence or two." />
      </label>
      <label>
        Support plan
        <textarea rows={3} value={form.support_plan} onChange={set('support_plan')}
          placeholder="What the school will do, and how parents can help at home." />
      </label>
      <label>
        Review date
        <input type="date" value={form.review_date || ''} onChange={set('review_date')} />
      </label>
      <p className="hint" style={{ marginTop: 0 }}>The review date is for staff only. It shows on the teacher&apos;s Home page when it is due.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : submitLabel}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

// Students who need extra support. HouseMaster suggests students from
// warning signs; a teacher confirms (parents are then told) or says no, and
// can mark any student by hand. Confirmed students keep a plan and a review date.
export default function Support() {
  const words = useVocab()
  const [suggested, setSuggested] = useState(null)
  const [concerns, setConcerns] = useState(null)
  const [students, setStudents] = useState([])
  const [open, setOpen] = useState(null) // which form is showing: "confirm-<id>", "edit-<id>", "resolve-<id>", "manual"
  const [manualStudent, setManualStudent] = useState('')
  const [resolveNote, setResolveNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    try {
      const [s, c] = await Promise.all([api.support.suggestions(), api.support.concerns.list({ status: 'open' })])
      setSuggested(s)
      setConcerns(c)
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => { load() }, [])

  async function act(fn, message) {
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

  async function openManual() {
    setOpen('manual')
    setManualStudent('')
    if (!students.length) {
      try {
        setStudents(await api.students.list())
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const confirm = (row) => (form) => act(
    () => api.support.concerns.create({ student: row.student, term: suggested.term, ...form }),
    toldParents(row.name),
  )
  const dismiss = (row) => act(
    () => api.support.concerns.dismiss(row.student, suggested.term),
    `${row.name} won't be suggested again this ${words.term.toLowerCase()}.`,
  )
  const createManual = (form) => {
    if (!manualStudent) {
      setError('Choose a student.')
      return Promise.resolve()
    }
    const name = students.find((s) => String(s.id) === String(manualStudent))
    return act(
      () => api.support.concerns.create({ student: Number(manualStudent), ...form, reasons: [] }),
      toldParents(name ? `${name.first_name} ${name.last_name}` : 'The student'),
    )
  }
  const save = (c) => (form) => act(
    () => api.support.concerns.update(c.id, { note: form.note, support_plan: form.support_plan, review_date: form.review_date }),
    'Saved.',
  )
  const resolve = (c) => act(() => api.support.concerns.resolve(c.id, resolveNote), `${c.student_name} no longer needs extra support.`)

  const loading = suggested === null || concerns === null
  const openIds = new Set((concerns || []).map((c) => c.student))
  const choosable = students.filter((s) => s.is_active !== false && !openIds.has(s.id))

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Needs support</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            Students who are struggling, so teachers and parents can act early.
          </p>
        </div>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={openManual}>Mark a student</button>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {open === 'manual' && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Mark a student as needing support</h3>
          <ConcernForm submitLabel="Mark and tell parents" onSubmit={createManual} onCancel={() => setOpen(null)}>
            <label>
              Student
              <select value={manualStudent} onChange={(e) => setManualStudent(e.target.value)}>
                <option value="">Choose…</option>
                {choosable.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name}</option>)}
              </select>
            </label>
          </ConcernForm>
        </div>
      )}

      {loading ? <p className="text-muted">Loading…</p> : (
        <>
          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>
              Suggested by HouseMaster{suggested.term_name ? ` · ${suggested.term_name}` : ''}
            </h3>
            <p className="hint" style={{ marginTop: 0 }}>
              Students with warning signs in their marks or attendance. Nothing is shared with parents until you confirm.
            </p>
            {suggested.results.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>No one to look at right now.</p>
            ) : (
              <ul className="support-list">
                {suggested.results.map((row) => (
                  <li key={row.student}>
                    <div className="support-row">
                      <div>
                        <strong>{row.name}</strong>
                        {row.class_name && <span className="text-muted"> · {row.class_name}</span>}
                        <ul className="support-reasons">{row.reasons.map((r) => <li key={r.code}>{r.label}</li>)}</ul>
                      </div>
                      {open !== `confirm-${row.student}` && (
                        <div className="support-actions">
                          <button type="button" style={{ width: 'auto' }} onClick={() => setOpen(`confirm-${row.student}`)}>Confirm</button>
                          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => dismiss(row)}>Not needed</button>
                        </div>
                      )}
                    </div>
                    {open === `confirm-${row.student}` && (
                      <ConcernForm reasons={row.reasons} submitLabel="Confirm and tell parents"
                        onSubmit={confirm(row)} onCancel={() => setOpen(null)} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Marked as needing support</h3>
            {concerns.length === 0 ? (
              <p className="text-muted" style={{ margin: 0 }}>No students are marked at the moment.</p>
            ) : (
              <ul className="support-list">
                {concerns.map((c) => (
                  <li key={c.id}>
                    <div className="support-row">
                      <div>
                        <strong>{c.student_name}</strong>
                        {c.class_name && <span className="text-muted"> · {c.class_name}</span>}
                        {reviewDue(c) && <span className="badge pending support-due" style={{ marginLeft: 8 }}>Review due</span>}
                        {c.reasons?.length > 0 && (
                          <ul className="support-reasons">{c.reasons.map((r) => <li key={r.code}>{r.label}</li>)}</ul>
                        )}
                        {c.note && <p style={{ margin: '4px 0' }}>{c.note}</p>}
                        {c.support_plan && <p style={{ margin: '4px 0' }}><strong>Plan:</strong> {c.support_plan}</p>}
                        <p className="hint" style={{ margin: '4px 0 0' }}>
                          Marked by {c.created_by_name || 'staff'} on {formatDate(c.created_at)}
                          {c.review_date ? ` · Review ${formatDate(c.review_date)}` : ''}
                          {c.parents_notified_at ? ' · Parents told' : ''}
                        </p>
                      </div>
                      {!open?.endsWith(`-c${c.id}`) && (
                        <div className="support-actions">
                          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(`edit-c${c.id}`)}>Edit</button>
                          <button type="button" className="secondary" style={{ width: 'auto' }}
                            onClick={() => { setResolveNote(''); setOpen(`resolve-c${c.id}`) }}>Resolve</button>
                        </div>
                      )}
                    </div>
                    {open === `edit-c${c.id}` && (
                      <ConcernForm initial={c} submitLabel="Save" onSubmit={save(c)} onCancel={() => setOpen(null)} />
                    )}
                    {open === `resolve-c${c.id}` && (
                      <form className="support-form" onSubmit={(e) => { e.preventDefault(); resolve(c) }}>
                        <label>
                          How did it go? (optional, staff only)
                          <textarea rows={2} value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} />
                        </label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button type="submit" style={{ width: 'auto' }}>No longer needs support</button>
                          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(null)}>Cancel</button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}

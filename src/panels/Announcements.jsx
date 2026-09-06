import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

const AUDIENCES = {
  all_staff: 'All staff',
  all_parents: 'All parents',
  year_group: 'Specific year group',
  school_class: 'Specific class',
}
const blankForm = { title: '', body: '', audience: 'all_staff', year_group: '', school_class: '' }

function errorMessage(error) {
  if (error.status === 403) return "You don’t have permission to do that."
  if (error.status === 404) return 'Announcement unavailable or not found.'
  return error.message || 'Something went wrong. Please try again.'
}

function backendFieldErrors(error) {
  if (!error.data || typeof error.data !== 'object' || Array.isArray(error.data)) return {}
  return Object.fromEntries(
    Object.entries(error.data)
      .filter(([key, value]) => ['title', 'body', 'audience', 'year_group', 'school_class'].includes(key) && value)
      .map(([key, value]) => [key, Array.isArray(value) ? value.join(' ') : String(value)])
  )
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString() : null
}

function audienceText(item, yearGroups, classes) {
  if (item.audience === 'year_group') {
    return yearGroups.find((group) => group.id === item.year_group)?.name || `Year group #${item.year_group}`
  }
  if (item.audience === 'school_class') {
    const schoolClass = classes.find((entry) => entry.id === item.school_class)
    const yearGroup = yearGroups.find((group) => group.id === schoolClass?.year_group)
    return schoolClass ? `${yearGroup?.name ? `${yearGroup.name} — ` : ''}${schoolClass.name}` : `Class #${item.school_class}`
  }
  return AUDIENCES[item.audience] || item.audience
}

function StatusBadge({ status }) {
  return <span className={`badge announcement-${status}`}>{status}</span>
}

function ConfirmDialog({ action, onCancel, onConfirm, busy }) {
  const cancelRef = useRef(null)
  const dialogRef = useRef(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onCancel()
      if (event.key === 'Tab') {
        const controls = dialogRef.current?.querySelectorAll('button:not(:disabled)') || []
        if (!controls.length) return
        const first = controls[0]
        const last = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [busy, onCancel])
  const publishing = action === 'publish'
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <h3 id="confirmation-title">{publishing ? 'Publish this announcement?' : 'Archive this announcement?'}</h3>
        <p>{publishing ? 'Once published, it cannot be edited. Staff visibility depends on the selected audience.' : 'It will no longer be active and cannot be edited.'}</p>
        <div className="form-actions">
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={publishing ? '' : 'danger-solid'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : publishing ? 'Publish announcement' : 'Archive announcement'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Announcements({ me }) {
  const admin = me?.role === 'admin'
  const [items, setItems] = useState([])
  const [yearGroups, setYearGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmAction, setConfirmAction] = useState(null)
  const [acting, setActing] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const data = await api.announcements.list(status ? { status } : undefined)
      setItems(data)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [status])
  useEffect(() => { loadTargets() }, [])

  async function loadTargets() {
    if (yearGroups.length || classes.length) return
    try {
      const [groups, schoolClasses] = await Promise.all([api.yearGroups.list(), api.schoolClasses.list()])
      setYearGroups(groups)
      setClasses(schoolClasses)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function openDetail(id) {
    setLoading(true)
    setError('')
    try {
      const item = await api.announcements.get(id)
      setSelected(item)
      setView('detail')
      loadTargets()
    } catch (err) {
      setError(errorMessage(err))
      setView('not-found')
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setForm(blankForm)
    setFormErrors({})
    setView('form')
    loadTargets()
  }

  function openEdit() {
    if (selected.status !== 'draft') return
    setForm({ title: selected.title, body: selected.body, audience: selected.audience, year_group: selected.year_group ? String(selected.year_group) : '', school_class: selected.school_class ? String(selected.school_class) : '' })
    setFormErrors({})
    setView('form')
    loadTargets()
  }

  function setAudience(audience) {
    setForm((current) => ({ ...current, audience, year_group: audience === 'year_group' ? current.year_group : '', school_class: audience === 'school_class' ? current.school_class : '' }))
  }

  function validate() {
    const errors = {}
    if (!form.title.trim()) errors.title = 'Enter a title.'
    else if (form.title.trim().length > 180) errors.title = 'Title must be 180 characters or fewer.'
    if (!form.body.trim()) errors.body = 'Enter a message.'
    if (form.audience === 'year_group' && !form.year_group) errors.year_group = 'Choose a year group.'
    if (form.audience === 'school_class' && !form.school_class) errors.school_class = 'Choose a class.'
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function saveDraft(event) {
    event.preventDefault()
    if (!validate()) return
    const payload = { title: form.title.trim(), body: form.body.trim(), audience: form.audience }
    if (form.audience === 'year_group') payload.year_group = Number(form.year_group)
    if (form.audience === 'school_class') payload.school_class = Number(form.school_class)
    setSaving(true)
    setError('')
    try {
      const saved = selected ? await api.announcements.update(selected.id, payload) : await api.announcements.create(payload)
      setSelected(saved)
      setView('detail')
      setToast(selected ? 'Draft updated.' : 'Draft saved.')
      load()
    } catch (err) {
      const fields = backendFieldErrors(err)
      if (Object.keys(fields).length) setFormErrors(fields)
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  async function confirmLifecycle() {
    const action = confirmAction
    setActing(true)
    try {
      const updated = action === 'publish' ? await api.announcements.publish(selected.id) : await api.announcements.archive(selected.id)
      setSelected(updated)
      setConfirmAction(null)
      setToast(action === 'publish' ? 'Announcement published.' : 'Announcement archived.')
      load()
    } catch (err) {
      setConfirmAction(null)
      setError(errorMessage(err))
    } finally {
      setActing(false)
    }
  }

  const targetClasses = form.year_group ? classes.filter((entry) => entry.year_group === Number(form.year_group)) : classes
  const backToList = () => { setView('list'); setSelected(null); setError(''); load() }

  if (view === 'not-found') return <div className="empty-state"><h3>Announcement unavailable</h3><p>{error || 'This announcement could not be found.'}</p><button className="secondary" onClick={backToList}>Back to announcements</button></div>

  if (view === 'form') return (
    <div className="announcement-form">
      <div className="panel-header"><div><h2>{selected ? 'Edit announcement' : 'New announcement'}</h2><p className="text-muted">Save your message as a draft. It will not be published automatically.</p></div></div>
      {error && <div className="error-banner">{error}</div>}
      <form className="card" onSubmit={saveDraft} noValidate>
        <div className="field"><label htmlFor="announcement-title">Title</label><input id="announcement-title" maxLength="180" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-invalid={!!formErrors.title} required /><div className="field-meta">{form.title.length}/180</div>{formErrors.title && <p className="field-error">{formErrors.title}</p>}</div>
        <div className="field"><label htmlFor="announcement-body">Message</label><textarea id="announcement-body" rows="8" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} aria-invalid={!!formErrors.body} required />{formErrors.body && <p className="field-error">{formErrors.body}</p>}</div>
        <div className="field"><label htmlFor="announcement-audience">Audience</label><select id="announcement-audience" value={form.audience} onChange={(e) => setAudience(e.target.value)}>{Object.entries(AUDIENCES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {form.audience === 'year_group' && <div className="field"><label htmlFor="announcement-year-group">Year group</label><select id="announcement-year-group" value={form.year_group} onChange={(e) => setForm({ ...form, year_group: e.target.value })} aria-invalid={!!formErrors.year_group}><option value="">Choose a year group</option>{yearGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>{formErrors.year_group && <p className="field-error">{formErrors.year_group}</p>}</div>}
        {form.audience === 'school_class' && <div className="field"><label htmlFor="announcement-class">Class</label><select id="announcement-class" value={form.school_class} onChange={(e) => setForm({ ...form, school_class: e.target.value })} aria-invalid={!!formErrors.school_class}><option value="">Choose a class</option>{targetClasses.map((entry) => { const group = yearGroups.find((item) => item.id === entry.year_group); return <option key={entry.id} value={entry.id}>{group ? `${group.name} — ` : ''}{entry.name}</option> })}</select>{formErrors.school_class && <p className="field-error">{formErrors.school_class}</p>}</div>}
        {form.audience === 'all_parents' && <div className="info-notice">Parent accounts are not enabled yet. This announcement will be saved with its intended audience.</div>}
        {(form.audience === 'year_group' || form.audience === 'school_class') && <div className="info-notice">Recipient delivery for parent/class audiences will be enabled when parent accounts and class memberships are available.</div>}
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button><button type="button" className="secondary" onClick={() => selected ? setView('detail') : backToList()} disabled={saving}>Cancel</button></div>
      </form>
    </div>
  )

  if (view === 'detail' && selected) return (
    <div>
      <div className="panel-header"><button className="back-button" onClick={backToList}>← Announcements</button>{admin && <div className="form-actions">{selected.status === 'draft' && <><button className="secondary" onClick={openEdit}>Edit</button><button onClick={() => setConfirmAction('publish')}>Publish</button></>}{selected.status === 'published' && <button className="danger" onClick={() => setConfirmAction('archive')}>Archive</button>}</div>}</div>
      {toast && <div className="success-banner" role="status">{toast}</div>}
      {error && <div className="error-banner">{error}</div>}
      <article className="announcement-detail card"><div className="announcement-detail-heading"><div><p className="eyebrow">{audienceText(selected, yearGroups, classes)}</p><h2>{selected.title}</h2></div>{admin && <StatusBadge status={selected.status} />}</div>{admin && selected.status === 'draft' && <p className="draft-notice">Draft — not visible to recipients.</p>}<div className="announcement-body">{selected.body}</div><dl className="announcement-meta"><div><dt>Audience</dt><dd>{audienceText(selected, yearGroups, classes)}</dd></div><div><dt>Author</dt><dd>{selected.created_by_name || '—'}</dd></div><div><dt>Created</dt><dd>{dateTime(selected.created_at)}</dd></div>{selected.published_at && <div><dt>Published</dt><dd>{dateTime(selected.published_at)}</dd></div>}{selected.archived_at && <div><dt>Archived</dt><dd>{dateTime(selected.archived_at)}</dd></div>}</dl></article>
      {confirmAction && <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={confirmLifecycle} busy={acting} />}
    </div>
  )

  return <div>
    <div className="panel-header"><div><h2>Announcements</h2><p className="text-muted">{admin ? 'Create and manage school announcements.' : 'School staff notices.'}</p></div>{admin && <button onClick={openCreate}>New announcement</button>}</div>
    {toast && <div className="success-banner" role="status">{toast}</div>}
    {admin && <div className="announcement-filters" aria-label="Filter announcements by status">{[['', 'All'], ['draft', 'Drafts'], ['published', 'Published'], ['archived', 'Archived']].map(([value, label]) => <button key={label} className={status === value ? 'active-filter' : 'secondary'} onClick={() => setStatus(value)}>{label}</button>)}</div>}
    {error && <div className="error-banner">{error}<button className="secondary retry-button" onClick={load}>Retry</button></div>}
    {loading ? <div className="announcement-skeleton" aria-label="Loading announcements"><span /><span /><span /></div> : items.length === 0 ? <div className="empty-state"><h3>{admin ? 'No announcements yet' : 'No staff announcements yet.'}</h3><p>{admin ? 'Create your first announcement.' : 'Published staff announcements will appear here.'}</p>{admin && <button onClick={openCreate}>New announcement</button>}</div> : <div className="announcement-list">{items.map((item) => <button className="announcement-card" key={item.id} onClick={() => openDetail(item.id)}><div className="announcement-card-top"><span className="eyebrow">{audienceText(item, yearGroups, classes)}</span>{admin && <StatusBadge status={item.status} />}</div><h3>{item.title}</h3><p>{item.body}</p><div className="announcement-card-footer"><span>{item.created_by_name || 'Unknown author'}</span><span>{item.status === 'published' ? `Published ${dateTime(item.published_at)}` : item.status === 'archived' ? `Archived ${dateTime(item.archived_at)}` : `Created ${dateTime(item.created_at)}`}</span></div>{admin && item.status === 'draft' && <span className="draft-helper">Draft — not visible to recipients.</span>}</button>)}</div>}
  </div>
}

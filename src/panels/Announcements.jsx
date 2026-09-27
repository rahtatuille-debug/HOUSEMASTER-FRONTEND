import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { announcementAuthor } from '../user.js'

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

function ReplaceDialog({ onCancel, onConfirm }) {
  const cancelRef = useRef(null)
  useEffect(() => { cancelRef.current?.focus() }, [])
  return (
    <div className="dialog-backdrop" role="presentation">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="replace-title">
        <h3 id="replace-title">Replace current announcement text?</h3>
        <p>Using the suggested text will replace the current title and message.</p>
        <div className="form-actions">
          <button ref={cancelRef} type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onConfirm}>Replace with suggested text</button>
        </div>
      </div>
    </div>
  )
}

// Assisted Communications: the AI suggests wording from a short brief. It
// never saves or publishes anything; the text lands in the normal form.
function AiDraftTool({ yearGroups, classes, audiences, initialContext, onUseDraft, autoApply = false, onManual }) {
  const [context, setContext] = useState(() => ({
    summary: '', audience: initialContext?.audience || Object.keys(audiences)[0],
    year_group: initialContext?.year_group || '', school_class: initialContext?.school_class || '',
  }))
  const [generated, setGenerated] = useState(null)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)

  function setAudience(audience) {
    setContext((value) => ({ ...value, audience, year_group: audience === 'year_group' ? value.year_group : '', school_class: audience === 'school_class' ? value.school_class : '' }))
  }

  function generationError(err) {
    if (err.status === 403) return "You don’t have permission to do that."
    if (err.status === 404) return 'The selected audience target could not be found.'
    if (err.status === 503) return 'Assisted Communications is unavailable right now. You can still write the announcement yourself.'
    return errorMessage(err)
  }

  async function generate() {
    const summary = context.summary.trim()
    const nextErrors = {}
    if (summary.length < 10) nextErrors.summary = 'Enter at least 10 characters.'
    if (summary.length > 2000) nextErrors.summary = 'Summary must be 2,000 characters or fewer.'
    if (context.audience === 'year_group' && !context.year_group) nextErrors.year_group = 'Choose a year group.'
    if (context.audience === 'school_class' && !context.school_class) nextErrors.school_class = 'Choose a class.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    const payload = { summary, audience: context.audience }
    if (context.audience === 'year_group') payload.year_group = Number(context.year_group)
    if (context.audience === 'school_class') payload.school_class = Number(context.school_class)
    setGenerating(true)
    setError('')
    try {
      const draft = await api.announcements.generateText(payload)
      setGenerated(draft)
      if (autoApply) onUseDraft(draft, context, true)
    } catch (err) {
      const data = err.data || {}
      setErrors(data.summary ? { summary: Array.isArray(data.summary) ? data.summary.join(' ') : String(data.summary) } : {})
      setError(generationError(err))
    } finally {
      setGenerating(false)
    }
  }

  const classOptions = classes
  return (
    <section className="ai-draft-tool card">
      <div className="ai-heading"><div><p className="eyebrow">Drafting help</p><h3>Assisted Communications</h3></div></div>
      <p className="text-muted">Describe what you need to say and get suggested wording to edit. Nothing is saved or published until you do it yourself.</p>
      {error && <div className="error-banner">{error}{onManual && <button type="button" className="secondary retry-button" onClick={onManual}>Write it yourself</button>}</div>}
      <div className="field"><label htmlFor="ai-summary">What would you like to communicate?</label><textarea id="ai-summary" rows="4" value={context.summary} onChange={(e) => setContext({ ...context, summary: e.target.value })} placeholder="Tell Year 8 parents that assessment week begins Monday and students should bring their normal stationery." aria-invalid={!!errors.summary} /><div className="field-meta">{context.summary.length}/2000</div>{errors.summary && <p className="field-error">{errors.summary}</p>}</div>
      <div className="field"><label htmlFor="ai-audience">Intended audience</label><select id="ai-audience" value={context.audience} onChange={(e) => setAudience(e.target.value)}>{Object.entries(audiences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      {context.audience === 'year_group' && <div className="field"><label htmlFor="ai-year-group">Year group</label><select id="ai-year-group" value={context.year_group} onChange={(e) => setContext({ ...context, year_group: e.target.value })} aria-invalid={!!errors.year_group}><option value="">Choose a year group</option>{yearGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>{errors.year_group && <p className="field-error">{errors.year_group}</p>}</div>}
      {context.audience === 'school_class' && <div className="field"><label htmlFor="ai-class">Class</label><select id="ai-class" value={context.school_class} onChange={(e) => setContext({ ...context, school_class: e.target.value })} aria-invalid={!!errors.school_class}><option value="">Choose a class</option>{classOptions.map((item) => { const group = yearGroups.find((entry) => entry.id === item.year_group); return <option key={item.id} value={item.id}>{group ? `${group.name} — ` : ''}{item.name}</option> })}</select>{errors.school_class && <p className="field-error">{errors.school_class}</p>}</div>}
      <div className="form-actions"><button type="button" onClick={generate} disabled={generating}>{generating ? 'Writing your announcement…' : generated ? 'Suggest again' : 'Suggest wording'}</button></div>
      {generating && <p className="ai-writing" role="status">Writing your announcement…</p>}
      {generated && (autoApply ? <p className="draft-notice">Suggested wording added below — review and edit it before saving.</p> : <div className="ai-output"><p className="draft-notice">Suggested wording — review and edit it before using it.</p><div className="field"><label htmlFor="alternative-ai-title">Title</label><input id="alternative-ai-title" value={generated.title} onChange={(e) => setGenerated({ ...generated, title: e.target.value })} /></div><div className="field"><label htmlFor="alternative-ai-body">Message</label><textarea id="alternative-ai-body" rows="6" value={generated.body} onChange={(e) => setGenerated({ ...generated, body: e.target.value })} /></div><div className="form-actions"><button type="button" onClick={() => onUseDraft(generated, context)}>Use this draft</button></div></div>)}
    </section>
  )
}

export default function Announcements({ me }) {
  const admin = me?.role === 'admin'
  // Teachers write to the parents of the classes they teach, and publish
  // those themselves; everything else is for admins.
  const myClassIds = new Set((me?.assignments || []).map((a) => a.school_class))
  const audiences = admin ? AUDIENCES : { school_class: 'Parents of a class I teach' }
  const canManage = (item) => admin || item.created_by === me?.id
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
  const [showAi, setShowAi] = useState(false)
  const [pendingAiDraft, setPendingAiDraft] = useState(null)
  const [aiCreateMode, setAiCreateMode] = useState(false)

  const myClasses = admin ? classes : classes.filter((c) => myClassIds.has(c.id))
  const canWrite = admin || myClassIds.size > 0

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
    setForm(admin ? blankForm : { ...blankForm, audience: 'school_class', school_class: myClasses.length === 1 ? String(myClasses[0].id) : '' })
    setFormErrors({})
    setShowAi(false)
    setAiCreateMode(false)
    loadTargets()
    setView('choice')
  }

  function startCreate(mode) {
    setShowAi(mode === 'ai')
    setAiCreateMode(mode === 'ai')
    setView('form')
  }

  function openEdit() {
    if (selected.status !== 'draft') return
    setForm({ title: selected.title, body: selected.body, audience: selected.audience, year_group: selected.year_group ? String(selected.year_group) : '', school_class: selected.school_class ? String(selected.school_class) : '' })
    setFormErrors({})
    setShowAi(false)
    setAiCreateMode(false)
    setView('form')
    loadTargets()
  }

  function setAudience(audience) {
    setForm((current) => ({ ...current, audience, year_group: audience === 'year_group' ? current.year_group : '', school_class: audience === 'school_class' ? current.school_class : '' }))
  }

  function useAiDraft(draft, context, fromGeneration = false) {
    const nextForm = { title: draft.title, body: draft.body, audience: context.audience, year_group: context.audience === 'year_group' ? context.year_group : '', school_class: context.audience === 'school_class' ? context.school_class : '' }
    if (!fromGeneration && (form.title.trim() || form.body.trim())) {
      setPendingAiDraft(nextForm)
      return
    }
    setForm(nextForm)
    if (!fromGeneration) setShowAi(false)
  }

  function applyPendingAiDraft() {
    setForm(pendingAiDraft)
    setPendingAiDraft(null)
    setShowAi(false)
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

  const targetClasses = !admin ? myClasses : form.year_group ? classes.filter((entry) => entry.year_group === Number(form.year_group)) : classes
  const backToList = () => { setView('list'); setSelected(null); setError(''); load() }

  if (view === 'not-found') return <div className="empty-state"><h3>Announcement unavailable</h3><p>{error || 'This announcement could not be found.'}</p><button className="secondary" onClick={backToList}>Back to announcements</button></div>

  if (view === 'choice') return (
    <div className="announcement-choice">
      <div className="panel-header"><div><h2>New announcement</h2><p className="text-muted">Choose how you would like to start. You can review and edit everything before saving.</p></div></div>
      <div className="creation-options">
        <button className="creation-option" onClick={() => startCreate('manual')}><h3>Write it yourself</h3><span>Type your own title and message.</span></button>
        <button className="creation-option" onClick={() => startCreate('ai')}><h3>Assisted Communications</h3><span>Describe what you need to say and get suggested wording you can edit.</span></button>
      </div>
      <button type="button" className="secondary" onClick={backToList}>Cancel</button>
    </div>
  )

  if (view === 'form') return (
    <div className="announcement-form">
      <div className="panel-header"><div><h2>{selected ? 'Edit announcement' : 'New announcement'}</h2><p className="text-muted">Save your message as a draft. It will not be published automatically.</p></div></div>
      {error && <div className="error-banner">{error}</div>}
      {showAi && <AiDraftTool yearGroups={yearGroups} classes={targetClasses} audiences={audiences} initialContext={form} onUseDraft={useAiDraft} autoApply={aiCreateMode} onManual={() => { setShowAi(false); setAiCreateMode(false) }} />}
      <form className="card" onSubmit={saveDraft} noValidate>
        <div className="form-section-heading"><h3>Announcement details</h3><button type="button" className="secondary" onClick={() => { setShowAi(!showAi); setAiCreateMode(false) }}>{showAi ? 'Hide Assisted Communications' : 'Assisted Communications'}</button></div>
        <div className="field"><label htmlFor="announcement-title">Title</label><input id="announcement-title" maxLength="180" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-invalid={!!formErrors.title} required /><div className="field-meta">{form.title.length}/180</div>{formErrors.title && <p className="field-error">{formErrors.title}</p>}</div>
        <div className="field"><label htmlFor="announcement-body">Message</label><textarea id="announcement-body" rows="8" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} aria-invalid={!!formErrors.body} required />{formErrors.body && <p className="field-error">{formErrors.body}</p>}</div>
        <div className="field"><label htmlFor="announcement-audience">Audience</label><select id="announcement-audience" value={form.audience} onChange={(e) => setAudience(e.target.value)}>{Object.entries(audiences).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        {form.audience === 'year_group' && <div className="field"><label htmlFor="announcement-year-group">Year group</label><select id="announcement-year-group" value={form.year_group} onChange={(e) => setForm({ ...form, year_group: e.target.value })} aria-invalid={!!formErrors.year_group}><option value="">Choose a year group</option>{yearGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>{formErrors.year_group && <p className="field-error">{formErrors.year_group}</p>}</div>}
        {form.audience === 'school_class' && <div className="field"><label htmlFor="announcement-class">Class</label><select id="announcement-class" value={form.school_class} onChange={(e) => setForm({ ...form, school_class: e.target.value })} aria-invalid={!!formErrors.school_class}><option value="">Choose a class</option>{targetClasses.map((entry) => { const group = yearGroups.find((item) => item.id === entry.year_group); return <option key={entry.id} value={entry.id}>{group ? `${group.name} — ` : ''}{entry.name}</option> })}</select>{formErrors.school_class && <p className="field-error">{formErrors.school_class}</p>}</div>}
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save draft'}</button><button type="button" className="secondary" onClick={() => selected ? setView('detail') : backToList()} disabled={saving}>Cancel</button></div>
      </form>
      {pendingAiDraft && <ReplaceDialog onCancel={() => setPendingAiDraft(null)} onConfirm={applyPendingAiDraft} />}
    </div>
  )

  if (view === 'detail' && selected) return (
    <div>
      <div className="panel-header"><button className="back-button" onClick={backToList}>← Announcements</button>{canManage(selected) && <div className="form-actions">{selected.status === 'draft' && <><button className="secondary" onClick={openEdit}>Edit</button><button onClick={() => setConfirmAction('publish')}>Publish</button></>}{selected.status === 'published' && <button className="danger" onClick={() => setConfirmAction('archive')}>Archive</button>}</div>}</div>
      {toast && <div className="success-banner" role="status">{toast}</div>}
      {error && <div className="error-banner">{error}</div>}
      <article className="announcement-detail card"><div className="announcement-detail-heading"><div><p className="eyebrow">{audienceText(selected, yearGroups, classes)}</p><h2>{selected.title}</h2></div>{canManage(selected) && <StatusBadge status={selected.status} />}</div>{canManage(selected) && selected.status === 'draft' && <p className="draft-notice">Draft — not visible to recipients.</p>}<div className="announcement-body">{selected.body}</div><dl className="announcement-meta"><div><dt>Audience</dt><dd>{audienceText(selected, yearGroups, classes)}</dd></div><div><dt>Author</dt><dd>{announcementAuthor(selected)}</dd></div><div><dt>Created</dt><dd>{dateTime(selected.created_at)}</dd></div>{selected.published_at && <div><dt>Published</dt><dd>{dateTime(selected.published_at)}</dd></div>}{selected.archived_at && <div><dt>Archived</dt><dd>{dateTime(selected.archived_at)}</dd></div>}</dl></article>
      {confirmAction && <ConfirmDialog action={confirmAction} onCancel={() => setConfirmAction(null)} onConfirm={confirmLifecycle} busy={acting} />}
    </div>
  )

  return <div>
    <div className="panel-header"><div><h2>Announcements</h2><p className="text-muted">{admin ? 'Create and manage school announcements.' : 'Staff notices, and announcements to the parents of your classes.'}</p></div>{canWrite && <button onClick={openCreate}>New announcement</button>}</div>
    {toast && <div className="success-banner" role="status">{toast}</div>}
    {canWrite && <div className="announcement-filters" aria-label="Filter announcements by status">{[['', 'All'], ['draft', 'Drafts'], ['published', 'Published'], ['archived', 'Archived']].map(([value, label]) => <button key={label} className={status === value ? 'active-filter' : 'secondary'} onClick={() => setStatus(value)}>{label}</button>)}</div>}
    {error && <div className="error-banner">{error}<button className="secondary retry-button" onClick={load}>Retry</button></div>}
    {loading ? <div className="announcement-skeleton" aria-label="Loading announcements"><span /><span /><span /></div> : items.length === 0 ? <div className="empty-state"><h3>No announcements yet</h3><p>{canWrite ? 'Create your first announcement.' : 'Published staff announcements will appear here.'}</p>{canWrite && <button onClick={openCreate}>New announcement</button>}</div> : <div className="announcement-list">{items.map((item) => <button className="announcement-card" key={item.id} onClick={() => openDetail(item.id)}><div className="announcement-card-top"><span className="eyebrow">{audienceText(item, yearGroups, classes)}</span>{canManage(item) && <StatusBadge status={item.status} />}</div><h3>{item.title}</h3><p>{item.body}</p><div className="announcement-card-footer"><span>{announcementAuthor(item)}</span><span>{item.status === 'published' ? `Published ${dateTime(item.published_at)}` : item.status === 'archived' ? `Archived ${dateTime(item.archived_at)}` : `Created ${dateTime(item.created_at)}`}</span></div>{canManage(item) && item.status === 'draft' && <span className="draft-helper">Draft — not visible to recipients.</span>}</button>)}</div>}
  </div>
}

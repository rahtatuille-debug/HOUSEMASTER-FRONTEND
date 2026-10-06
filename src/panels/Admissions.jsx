import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate, formatDateTime } from '../format.js'
import { errorText } from './Timetable.jsx'

const STAGES = [
  ['new', 'New'], ['reviewing', 'Reviewing'], ['interview', 'Interview or test'], ['offered', 'Offered a place'],
  ['accepted', 'Place accepted'], ['waitlist', 'Waiting list'], ['declined', 'Not offered a place'],
  ['withdrawn', 'Withdrawn'],
]
const OPEN = ['new', 'reviewing', 'interview', 'offered', 'accepted', 'waitlist']
const TOLD = { interview: 'invited to interview', offered: 'offered a place', waitlist: 'put on the waiting list', declined: 'told there is no place' }
const BADGE = { new: 'pending', reviewing: 'pending', interview: 'draft', offered: 'approved', accepted: 'approved',
  waitlist: 'draft', declined: 'rejected', withdrawn: 'cancelled', enrolled: 'finalized' }
const SHORT = { dateStyle: 'medium', timeStyle: 'short' }

// The application form's settings: open or closed, the link, the welcome text and which year groups.
function FormSettings({ yearGroups }) {
  const [settings, setSettings] = useState(null)
  const [intro, setIntro] = useState('')
  const [keepDays, setKeepDays] = useState('')
  const [prefix, setPrefix] = useState('')
  const [nextNumber, setNextNumber] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    api.admissions.settings().then((s) => {
      setSettings(s); setIntro(s.intro); setKeepDays(s.retention_days ?? ''); setPrefix(s.number_prefix || ''); setNextNumber(s.next_number ?? '')
    })
      .catch((e) => setError(errorText(e)))
  }, [])
  if (!settings) return error ? <div className="error-banner">{error}</div> : null
  const link = `${window.location.origin}/apply/${settings.link_token}`

  async function save(body, message) {
    setError('')
    try {
      setSettings(await api.admissions.saveSettings(body))
      setNotice(message)
    } catch (err) {
      setError(errorText(err))
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setNotice('Link copied.')
    } catch {
      setNotice(link)
    }
  }
  const toggleYear = (id) => save({ year_groups: settings.year_groups.includes(id)
    ? settings.year_groups.filter((y) => y !== id) : [...settings.year_groups, id] }, 'Saved.')

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Application form</h3>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={settings.is_open}
          onChange={(e) => save({ is_open: e.target.checked }, e.target.checked ? 'The form is open.' : 'The form is closed.')} />
        Open for applications
      </label>
      <p style={{ margin: '10px 0 4px' }}>Share this link on your website, by WhatsApp or by email:</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <code style={{ wordBreak: 'break-all' }}>{link}</code>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={copy}>Copy link</button>
        <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }}
          onClick={() => api.admissions.newLink().then((s) => { setSettings(s); setNotice('New link made. The old one no longer works.') }).catch((e) => setError(errorText(e)))}>
          Make a new link
        </button>
      </div>
      <label style={{ marginTop: 12 }}>Welcome text on the form
        <textarea rows={3} value={intro} onChange={(e) => setIntro(e.target.value)} onBlur={() => intro !== settings.intro && save({ intro }, 'Saved.')} />
      </label>
      <label style={{ marginTop: 12, maxWidth: 360 }}>Delete closed applications after (days)
        <input type="number" min="1" value={keepDays} onChange={(e) => setKeepDays(e.target.value)}
          onBlur={() => {
            const days = keepDays === '' ? null : Number(keepDays)
            if (days !== (settings.retention_days ?? null)) save({ retention_days: days }, days ? `Closed applications are deleted ${days} days after their last change.` : 'Closed applications are kept until you delete them.')
          }} />
      </label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <label style={{ flex: '1 1 160px' }}>Admission number prefix
          <input value={prefix} maxLength={40} placeholder="e.g. ADM/2026/" onChange={(e) => setPrefix(e.target.value)}
            onBlur={() => prefix !== (settings.number_prefix || '') && save({ number_prefix: prefix }, 'Saved.')} />
        </label>
        <label style={{ flex: '1 1 160px' }}>Next admission number
          <input type="number" min="1" value={nextNumber} onChange={(e) => setNextNumber(e.target.value)}
            onBlur={() => nextNumber !== '' && Number(nextNumber) !== settings.next_number && save({ next_number: Number(nextNumber) }, 'Saved.')} />
        </label>
      </div>
      <p className="hint" style={{ margin: '2px 0 0' }}>Each student enrolled from here gets the next free number (one already in use is skipped). Existing students keep theirs.</p>
      <p className="hint" style={{ margin: '2px 0 0' }}>Declined, withdrawn and enrolled applications, counted from their last change. Empty: kept until you delete them. Takes effect when the school&apos;s data clean-up runs.</p>
      {yearGroups.length > 0 && (
        <>
          <p style={{ margin: '10px 0 4px' }}>Year groups taking applications <span className="hint">(none ticked: all of them)</span></p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {yearGroups.map((y) => (
              <label key={y.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                <input type="checkbox" style={{ width: 'auto' }} checked={settings.year_groups.includes(y.id)} onChange={() => toggleYear(y.id)} />{y.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// One applicant: their details, staff notes, moving them on, and enrolling.
function ApplicationDetail({ app, classes, onChanged, onClose }) {
  const [form, setForm] = useState({ status: app.status, interview_at: app.interview_at ? app.interview_at.slice(0, 16) : '',
    decision_note: app.decision_note, staff_notes: app.staff_notes, tell_family: true })
  const [schoolClass, setSchoolClass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm({ ...form, [key]: key === 'tell_family' ? e.target.checked : e.target.value })
  const enrolled = app.status === 'enrolled'
  const fitting = classes.filter((c) => !app.year_group || c.year_group === app.year_group)

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }
  const save = () => run(async () => {
    const body = { staff_notes: form.staff_notes, decision_note: form.decision_note, tell_family: form.tell_family,
      interview_at: form.interview_at ? new Date(form.interview_at).toISOString() : null }
    if (form.status !== app.status) body.status = form.status
    await api.admissions.update(app.id, body)
    const told = body.status && TOLD[body.status] && form.tell_family ? ` The family has been emailed (${TOLD[body.status]}).` : ''
    onChanged(`Saved ${app.first_name} ${app.last_name}.${told}`)
  })
  const enrol = () => run(async () => {
    const result = await api.admissions.enrol(app.id, Number(schoolClass))
    onChanged(result.message)
  })
  const remove = () => run(async () => {
    if (!window.confirm(`Delete ${app.first_name} ${app.last_name}'s application? This can't be undone.`)) return
    await api.admissions.remove(app.id)
    onChanged('Application deleted.')
  })
  const row = (label, value) => value ? <li><span>{label}</span> {value}</li> : null

  return (
    <div className="card tt-form">
      <div className="support-row">
        <div>
          <h3 style={{ fontSize: 17, margin: 0 }}>{app.first_name} {app.last_name}</h3>
          <p className="hint" style={{ margin: '2px 0 0' }}>{app.reference} · applied {formatDate(app.created_at)}</p>
        </div>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onClose}>Close</button>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {app.age_note && <div className="support-box" role="status" style={{ marginTop: 10 }}>{app.age_note}</div>}
      <ul className="fact-list" style={{ marginTop: 10 }}>
        {row('Applying for', [app.year_group_name, app.start].filter(Boolean).join(' · '))}
        {row('Date of birth', formatDate(app.date_of_birth))}
        {row('Gender', app.gender)}
        {row('Current school', app.current_school)}
        {row('Day or boarding', app.mode_of_learning)}
        {row('Needs to discuss', app.has_needs === true ? 'Yes: ask the family after an offer' : app.has_needs === false ? 'No' : '')}
        {row('Health or learning needs (older application)', app.medical_notes)}
        {row('From the family', app.notes)}
        {row('Parent', `${app.parent_name}${app.relationship ? ` (${app.relationship})` : ''}`)}
        {row('Email', <a href={`mailto:${app.parent_email}`}>{app.parent_email}</a>)}
        {row('Phone', app.parent_phone && <a href={`tel:${app.parent_phone.replace(/[^+\d]/g, '')}`}>{app.parent_phone}</a>)}
        {enrolled && row('Enrolled in', app.student_class)}
        {enrolled && row('Admission number', app.student_number)}
      </ul>
      {!enrolled && (
        <div className="tt-form-grid" style={{ marginTop: 12 }}>
          <label>Stage
            <select value={form.status} onChange={set('status')}>
              {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
          {form.status === 'interview' && (
            <label>Interview or test on<input type="datetime-local" value={form.interview_at} onChange={set('interview_at')} /></label>
          )}
          <label style={{ gridColumn: '1 / -1' }}>Note for the family (sent with interview, offer, waiting list or decline)
            <textarea rows={2} value={form.decision_note} onChange={set('decision_note')} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>Staff notes (never sent)
            <textarea rows={2} value={form.staff_notes} onChange={set('staff_notes')} />
          </label>
          {form.status !== app.status && TOLD[form.status] && (
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400, gridColumn: '1 / -1' }}>
              <input type="checkbox" style={{ width: 'auto' }} checked={form.tell_family} onChange={set('tell_family')} />
              Email the family
            </label>
          )}
          <div className="tt-form-actions">
            <button type="button" disabled={busy} style={{ width: 'auto' }} onClick={save}>Save</button>
            <button type="button" className="secondary" disabled={busy} style={{ width: 'auto' }} onClick={remove}>Delete</button>
          </div>
        </div>
      )}
      {['offered', 'accepted'].includes(app.status) && (
        <div className="support-box" style={{ marginTop: 12 }}>
          <strong>Enrol</strong>
          <p className="hint" style={{ margin: '2px 0 6px' }}>Adds {app.first_name} to a class and invites {app.parent_name} to HouseMaster.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ flex: '1 1 200px' }}>Class
              <select value={schoolClass} onChange={(e) => setSchoolClass(e.target.value)}>
                <option value="">Choose…</option>
                {(fitting.length ? fitting : classes).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <button type="button" disabled={busy || !schoolClass} style={{ width: 'auto' }} onClick={enrol}>Enrol</button>
          </div>
        </div>
      )}
    </div>
  )
}

// Admissions (admins): the application form and every application.
export default function Admissions() {
  const [filter, setFilter] = useState('open')
  const [apps, setApps] = useState(null)
  const [counts, setCounts] = useState({})
  const [yearGroups, setYearGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [openId, setOpenId] = useState(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const status = filter === 'open' ? OPEN.join(',') : filter === 'closed' ? 'declined,withdrawn,enrolled' : filter
    const [list, summary] = await Promise.all([
      api.admissions.list(filter === 'unconfirmed' ? { unconfirmed: 1 } : { status }), api.admissions.summary()])
    setApps(list)
    setCounts({ ...summary.counts, unconfirmed: summary.unconfirmed || 0 })
  }, [filter])
  useEffect(() => { load().catch((e) => setError(errorText(e))) }, [load])
  useEffect(() => {
    Promise.all([api.yearGroups.list(), api.schoolClasses.list()]).then(([y, c]) => { setYearGroups(y); setClasses(c) }).catch(() => {})
  }, [])

  const total = (keys) => keys.reduce((n, k) => n + (counts[k] || 0), 0)
  const filters = [['open', `In progress (${total(OPEN)})`], ...STAGES.slice(0, 6).map(([k, l]) => [k, `${l} (${counts[k] || 0})`]),
    ['closed', `Closed (${total(['declined', 'withdrawn', 'enrolled'])})`],
    ...(counts.unconfirmed ? [['unconfirmed', `Email not confirmed (${counts.unconfirmed})`]] : [])]
  const shown = (apps || []).filter((a) => !query || `${a.first_name} ${a.last_name} ${a.parent_name} ${a.parent_email}`.toLowerCase().includes(query.toLowerCase()))
  const open = shown.find((a) => a.id === openId) || (apps || []).find((a) => a.id === openId)

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Admissions</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Applications from your online form, from new to enrolled.</p>
        </div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <FormSettings yearGroups={yearGroups} />
      {open && (
        <ApplicationDetail key={open.id + open.status} app={open} classes={classes}
          onClose={() => setOpenId(null)}
          onChanged={(message) => { setNotice(message); setOpenId(null); load() }} />
      )}
      <div className="card">
        <div className="support-row" style={{ marginBottom: 8 }}>
          <div className="guardian-subtabs" role="tablist" aria-label="Show">
            {filters.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={filter === key}
                className={filter === key ? 'active-filter' : 'secondary'} onClick={() => { setFilter(key); setOpenId(null) }}>{label}</button>
            ))}
          </div>
          <input type="search" aria-label="Find an applicant" placeholder="Find an applicant" value={query}
            onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 240 }} />
        </div>
        {filter === 'unconfirmed' && (
          <p className="hint" style={{ marginTop: 0 }}>The family hasn't confirmed their email yet, so these can't be moved on.
            If the link expires, the family has to apply again.</p>
        )}
        {!apps ? <p className="text-muted">Loading…</p> : shown.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No applications here.</p> : (
          <table className="data-table">
            <thead><tr><th>Applicant</th><th>For</th><th>Parent</th><th>Applied</th><th>Stage</th></tr></thead>
            <tbody>
              {shown.map((a) => (
                <tr key={a.id}>
                  <td className="row-title">
                    {filter === 'unconfirmed' ? `${a.first_name} ${a.last_name}` : (
                      <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }}
                        onClick={() => { setNotice(''); setOpenId(a.id) }}>{a.first_name} {a.last_name}</button>
                    )}
                  </td>
                  <td data-label="For">{a.year_group_name || '—'}</td>
                  <td data-label="Parent">{a.parent_name}</td>
                  <td data-label="Applied">{formatDate(a.created_at)}</td>
                  <td data-label="Stage">
                    <span className={`badge ${BADGE[a.status]}`}>{a.status_label}</span>
                    {a.status === 'interview' && a.interview_at && <div className="hint" style={{ margin: 0 }}>{formatDateTime(a.interview_at, SHORT)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

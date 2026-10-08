import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'

export const EVENT_KINDS = [
  ['event', 'Event'], ['holiday', 'Holiday or school closed'], ['exam', 'Exams'], ['meeting', "Parents' meeting"],
  ['trip', 'Trip or visit'], ['sport', 'Sport'], ['performance', 'Performance or show'], ['deadline', 'Deadline'],
  ['staff', 'Staff training or meeting'],
]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parse = (s) => new Date(`${s}T12:00:00`)
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const time = (t) => (t ? t.slice(0, 5) : '')
const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message

// The six weeks shown for a month, Monday first.
function monthGrid(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// Each item on every day it covers (multi-day events repeat).
function byDay(items) {
  const map = new Map()
  for (const item of items) {
    let d = parse(item.start_date)
    const last = parse(item.end_date || item.start_date)
    for (let n = 0; d <= last && n < 62; n += 1, d = addDays(d, 1)) {
      const key = iso(d)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
  }
  return map
}

export function whenText(item) {
  const days = item.end_date && item.end_date !== item.start_date
    ? `${formatDate(item.start_date, { day: 'numeric', month: 'short' })} to ${formatDate(item.end_date, { day: 'numeric', month: 'short' })}` : ''
  const hours = item.start_time ? `${time(item.start_time)}${item.end_time ? `–${time(item.end_time)}` : ''}` : (item.type === 'event' ? 'All day' : '')
  return [days, hours].filter(Boolean).join(' · ')
}

const BLANK = { title: '', kind: 'event', start_date: '', end_date: '', start_time: '', end_time: '', location: '', description: '', staff_only: false, year_groups: [] }

function EventForm({ initial, yearGroups, onSubmit, onCancel, onDelete }) {
  const [form, setForm] = useState({ ...BLANK, ...initial, start_time: time(initial?.start_time), end_time: time(initial?.end_time),
    end_date: initial?.end_date || '', year_groups: (initial?.year_group_ids || []).map(String) })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const who = form.staff_only ? 'staff' : form.year_groups.length ? 'years' : 'everyone'
  const setWho = (value) => setForm({ ...form, staff_only: value === 'staff', year_groups: value === 'years' ? (form.year_groups.length ? form.year_groups : []) : [] })
  const toggle = (id) => setForm({ ...form, year_groups: form.year_groups.includes(id) ? form.year_groups.filter((y) => y !== id) : [...form.year_groups, id] })
  const [chooseYears, setChooseYears] = useState(who === 'years')
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ title: form.title, kind: form.kind, start_date: form.start_date, end_date: form.end_date || null,
        start_time: form.start_time || null, end_time: form.end_time || null, location: form.location,
        description: form.description, staff_only: form.staff_only, year_groups: chooseYears && !form.staff_only ? form.year_groups.map(Number) : [] })
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="tt-form-grid discipline-form">
      <label className="span-all">Title<input value={form.title} onChange={set('title')} maxLength={150} required placeholder="e.g. Sports day" /></label>
      <label>Kind
        <select value={form.kind} onChange={set('kind')}>{EVENT_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>Where (optional)<input value={form.location} onChange={set('location')} maxLength={150} /></label>
      <label>Date<input type="date" value={form.start_date} onChange={set('start_date')} required /></label>
      <label>Until (optional)<input type="date" value={form.end_date} min={form.start_date} onChange={set('end_date')} /></label>
      <label>Starts (blank for all day)<input type="time" value={form.start_time} onChange={set('start_time')} /></label>
      <label>Ends (optional)<input type="time" value={form.end_time} onChange={set('end_time')} disabled={!form.start_time} /></label>
      <fieldset className="span-all cover-periods">
        <legend>Who sees it</legend>
        <label className="check-row"><input type="radio" checked={!form.staff_only && !chooseYears} onChange={() => { setWho('everyone'); setChooseYears(false) }} /> Everyone</label>
        <label className="check-row"><input type="radio" checked={!form.staff_only && chooseYears} onChange={() => { setWho('years'); setChooseYears(true) }} /> Chosen year groups</label>
        <label className="check-row"><input type="radio" checked={form.staff_only} onChange={() => { setWho('staff'); setChooseYears(false) }} /> Staff only</label>
        {chooseYears && !form.staff_only && (
          <div className="checkbox-list">
            {yearGroups.map((y) => <label key={y.id}><input type="checkbox" checked={form.year_groups.includes(String(y.id))} onChange={() => toggle(String(y.id))} /> {y.name}</label>)}
          </div>
        )}
      </fieldset>
      <label className="span-all">Details (optional)<textarea rows={2} value={form.description} onChange={set('description')} maxLength={2000} /></label>
      <div className="tt-form-actions">
        <button type="submit" disabled={busy || (chooseYears && !form.staff_only && form.year_groups.length === 0)} style={{ width: 'auto' }}>{busy ? 'Saving…' : initial?.event ? 'Save' : 'Add to calendar'}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
        {onDelete && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={onDelete}>Remove</button>}
      </div>
    </form>
  )
}

function ItemLine({ item, onEdit }) {
  return (
    <li className={`cal-item cal-${item.kind}`}>
      <span className="cal-dot" aria-hidden="true" />
      <div className="cal-item-body">
        <strong>{item.title}</strong>
        <span className="text-muted">{[item.kind_label, whenText(item), item.location].filter(Boolean).join(' · ')}</span>
        {(item.year_groups?.length > 0 || item.staff_only) && (
          <span className="hint" style={{ margin: 0 }}>{item.staff_only ? 'Staff only' : `For ${item.year_groups.join(', ')}`}</span>
        )}
        {item.picked?.length > 0 && <span className="badge finalized" style={{ alignSelf: 'flex-start' }}>{item.picked.join(' and ')} {item.picked.length === 1 ? 'is' : 'are'} in the squad</span>}
        {item.description && <span className="hint" style={{ margin: 0 }}>{item.description}</span>}
      </div>
      {item.can_edit && onEdit && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => onEdit(item)} aria-label={`Change ${item.title}`}>Change</button>}
    </li>
  )
}

// The link to add this calendar to a phone or computer calendar app.
function AppLink() {
  const [open, setOpen] = useState(false)
  const [feed, setFeed] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  async function show() {
    setOpen(true)
    try { setFeed(await api.calendar.feed()) } catch (err) { setError(err.message) }
  }
  async function renew() {
    if (!window.confirm('Make a new link? Calendar apps using the old link stop updating until you add the new one.')) return
    try { setFeed(await api.calendar.renewFeed()); setCopied(false) } catch (err) { setError(err.message) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(feed.url); setCopied(true) } catch { setCopied(false) }
  }
  if (!open) return <button type="button" className="secondary" style={{ width: 'auto' }} onClick={show}>Add to my phone&apos;s calendar</button>
  return (
    <div className="card cal-feed">
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Add to your phone or computer calendar</h3>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!feed ? <p className="text-muted">Loading…</p> : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>On a phone, tap Subscribe. Or copy the link into Google Calendar (Other calendars → From URL), Outlook or Apple Calendar. It updates by itself. Keep the link private: anyone with it can see this calendar.</p>
          <div className="cal-feed-row">
            <a className="button-link" href={feed.webcal}>Subscribe</a>
            <input readOnly value={feed.url} aria-label="Calendar link" onFocus={(e) => e.target.select()} />
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
            <button type="button" className="link-button" style={{ width: 'auto' }} onClick={renew}>Make a new link</button>
            <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => setOpen(false)}>Close</button>
          </div>
        </>
      )}
    </div>
  )
}

// The school calendar: the school's events, term dates and fixtures. Staff
// see everything; parents see what's for their children. Leadership, admins
// and the secretary add events.
export default function Calendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1, 12) })
  const [data, setData] = useState(null)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(null) // "new" or an item
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const days = useMemo(() => monthGrid(month), [month])

  const load = useCallback(async () => {
    try {
      setData(await api.calendar.get({ from: iso(days[0]), to: iso(days[41]) }))
    } catch (err) {
      setError(err.message)
    }
  }, [days])
  useEffect(() => { load() }, [load])

  const items = Array.isArray(data?.items) ? data.items : []
  const map = useMemo(() => byDay(items), [items])
  const today = data?.today || iso(new Date())
  const inMonth = (d) => d.getMonth() === month.getMonth()
  const monthItems = items.filter((i) => {
    const s = parse(i.start_date), e = parse(i.end_date || i.start_date)
    return e >= new Date(month.getFullYear(), month.getMonth(), 1) && s < new Date(month.getFullYear(), month.getMonth() + 1, 1)
  })
  const listed = selected ? (map.get(selected) || []) : monthItems

  async function save(body) {
    setError('')
    try {
      if (editing?.event) await api.calendar.events.update(editing.event, body)
      else await api.calendar.events.create(body)
      setNotice(editing?.event ? 'Saved.' : `${body.title} was added to the calendar.`)
      setEditing(null)
      await load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  async function remove() {
    if (!window.confirm(`Remove ${editing.title} from the calendar?`)) return
    try {
      await api.calendar.events.remove(editing.event)
      setNotice(`${editing.title} was removed.`)
      setEditing(null)
      await load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  const shift = (n) => { setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1, 12)); setSelected(null) }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Calendar</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Term dates, school events and fixtures.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {data?.can_manage && <button type="button" style={{ width: 'auto' }} onClick={() => setEditing('new')}>Add an event</button>}
        </div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {editing && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>{editing === 'new' ? 'Add an event' : `Change ${editing.title}`}</h3>
          <EventForm initial={editing === 'new' ? { start_date: selected || today } : editing} yearGroups={data?.year_groups || []}
            onSubmit={save} onCancel={() => setEditing(null)} onDelete={editing !== 'new' ? remove : null} />
        </div>
      )}

      <div className="card cal-card">
        <div className="cal-nav">
          <button type="button" className="secondary" style={{ width: 'auto' }} aria-label="Previous month" onClick={() => shift(-1)}>‹</button>
          <h3>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          <button type="button" className="secondary" style={{ width: 'auto' }} aria-label="Next month" onClick={() => shift(1)}>›</button>
          {!(month.getMonth() === parse(today).getMonth() && month.getFullYear() === parse(today).getFullYear()) && (
            <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => { const t = parse(today); setMonth(new Date(t.getFullYear(), t.getMonth(), 1, 12)); setSelected(null) }}>Today</button>
          )}
        </div>
        <div className="cal-grid" role="grid" aria-label="Month">
          {WEEKDAYS.map((w) => <div key={w} className="cal-weekday" role="columnheader">{w}</div>)}
          {days.map((d) => {
            const key = iso(d)
            const dayItems = map.get(key) || []
            return (
              <button key={key} type="button" role="gridcell" aria-selected={selected === key}
                aria-label={`${formatDate(key, { weekday: 'long', day: 'numeric', month: 'long' })}: ${dayItems.length ? dayItems.map((i) => i.title).join(', ') : 'nothing'}`}
                className={`cal-day${inMonth(d) ? '' : ' other'}${key === today ? ' today' : ''}${selected === key ? ' selected' : ''}`}
                onClick={() => setSelected(selected === key ? null : key)}>
                <span className="cal-date">{d.getDate()}</span>
                {dayItems.slice(0, 3).map((i) => <span key={i.id} className={`cal-chip cal-${i.kind}`}>{i.title}</span>)}
                {dayItems.length > 3 && <span className="cal-more">+{dayItems.length - 3} more</span>}
                {dayItems.length > 0 && <span className="cal-dots" aria-hidden="true">{dayItems.slice(0, 4).map((i) => <span key={i.id} className={`cal-dot cal-${i.kind}`} />)}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="card">
        <div className="cal-list-head">
          <h3 style={{ fontSize: 15, margin: 0 }}>{selected ? formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : `In ${month.toLocaleDateString(undefined, { month: 'long' })}`}</h3>
          {selected && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => setSelected(null)}>Whole month</button>}
        </div>
        {!data ? <p className="text-muted">Loading…</p> : listed.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>Nothing on the calendar.</p> : (
          <ul className="cal-list">
            {listed.map((i) => (
              <li key={i.id} className="cal-list-day">
                {!selected && <span className="cal-list-date">{formatDate(i.start_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>}
                <ul className="support-list"><ItemLine item={i} onEdit={setEditing} /></ul>
              </li>
            ))}
          </ul>
        )}
      </div>
      <AppLink />
    </div>
  )
}

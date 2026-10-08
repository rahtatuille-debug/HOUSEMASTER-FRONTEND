import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'

const REASONS = [['sick', 'Sick'], ['training', 'Training or course'], ['trip', 'School trip'], ['personal', 'Personal or family'], ['other', 'Other']]
const SUPERVISED = 'none'

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const shift = (iso, days) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + days); return isoDay(d) }
const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message

// Record who is away; their lessons that day appear with the staff free to cover each one.
function AbsenceForm({ staff, periods, date, onSaved, onCancel }) {
  const [form, setForm] = useState({ teacher: '', start_date: date, end_date: date, reason: 'sick', note: '', allDay: true, periods: [] })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const oneDay = form.start_date === form.end_date
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.timetable.absences.create({
        teacher: Number(form.teacher), start_date: form.start_date, end_date: form.end_date || form.start_date,
        reason: form.reason, note: form.note, periods: oneDay && !form.allDay ? form.periods : [],
      })
      onSaved()
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  const toggle = (id) => setForm({ ...form, periods: form.periods.includes(id) ? form.periods.filter((p) => p !== id) : [...form.periods, id] })
  return (
    <form onSubmit={submit} className="tt-form-grid cover-form">
      {error && <div className="error-banner span-all" role="alert">{error}</div>}
      <label>Who is away
        <select value={form.teacher} onChange={set('teacher')} required>
          <option value="">Choose…</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label>From<input type="date" value={form.start_date} onChange={set('start_date')} required /></label>
      <label>To<input type="date" value={form.end_date} min={form.start_date} onChange={set('end_date')} required /></label>
      <label>Why
        <select value={form.reason} onChange={set('reason')}>
          {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      {oneDay && (
        <fieldset className="span-all cover-periods">
          <legend>When</legend>
          <label className="check-row"><input type="radio" checked={form.allDay} onChange={() => setForm({ ...form, allDay: true })} /> The whole day</label>
          <label className="check-row"><input type="radio" checked={!form.allDay} onChange={() => setForm({ ...form, allDay: false })} /> Only some lessons</label>
          {!form.allDay && (
            <div className="chip-list">
              {periods.map((p) => (
                <label key={p.id} className="check-row">
                  <input type="checkbox" checked={form.periods.includes(p.id)} onChange={() => toggle(p.id)} /> {p.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}
      <label className="span-all">Note for whoever arranges cover (optional)
        <input value={form.note} onChange={set('note')} maxLength={300} placeholder="e.g. Work is set on the class page" />
      </label>
      <div className="tt-form-actions">
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : 'Record absence'}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function CoverRow({ row, date, onChanged, onError }) {
  const [choice, setChoice] = useState(row.cover ? String(row.cover.teacher || SUPERVISED) : '')
  const [note, setNote] = useState(row.cover?.note || '')
  const [editing, setEditing] = useState(!row.cover)
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await api.timetable.cover.arrange({ lesson: row.id, date, cover_teacher: choice === SUPERVISED ? null : Number(choice), note })
      setEditing(false)
      onChanged(choice === SUPERVISED ? `${row.class_name} ${row.label} marked as supervised.`
        : `${row.free.find((f) => String(f.id) === choice)?.name || 'They'} will cover ${row.class_name} ${row.label}.`)
    } catch (err) {
      onError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  async function undo() {
    setBusy(true)
    try {
      await api.timetable.cover.remove(row.id, date)
      onChanged(`Cover removed for ${row.class_name} ${row.label}.`)
    } catch (err) {
      onError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  // Whoever already covers it stays in the list even though they're now "busy".
  const options = row.cover?.teacher && !row.free.some((f) => f.id === row.cover.teacher)
    ? [{ id: row.cover.teacher, name: row.cover.teacher_name, lessons_today: null }, ...row.free] : row.free
  return (
    <li className={`cover-row${row.cover ? ' covered' : ''}`}>
      <div className="cover-when"><strong>{row.start_time}</strong><span className="text-muted">{row.period_name}</span></div>
      <div className="cover-what">
        <strong>{row.class_name} {row.label}</strong>
        <span className="text-muted">{[row.teacher_name || 'No teacher', row.why, row.room_name].filter(Boolean).join(' · ')}</span>
      </div>
      {editing || !row.cover ? (
        <div className="cover-pick">
          <select aria-label={`Cover for ${row.class_name} ${row.label} at ${row.start_time}`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose who covers…</option>
            {options.map((f) => <option key={f.id} value={f.id}>{f.name}{f.lessons_today != null ? ` (${f.lessons_today} lesson${f.lessons_today === 1 ? '' : 's'} today)` : ''}</option>)}
            <option value={SUPERVISED}>No cover teacher (supervised another way)</option>
          </select>
          <input aria-label={`Note for the cover of ${row.class_name} ${row.label}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Note (optional)" />
          <button type="button" style={{ width: 'auto' }} disabled={!choice || busy} onClick={save}>Save</button>
          {row.cover && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setEditing(false)}>Cancel</button>}
        </div>
      ) : (
        <div className="cover-pick">
          <span className="badge finalized">{row.cover.teacher_name ? `Covered by ${row.cover.teacher_name}` : 'Supervised'}</span>
          {row.cover.note && <span className="text-muted">{row.cover.note}</span>}
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setEditing(true)}>Change</button>
          <button type="button" className="link-button" style={{ width: 'auto' }} disabled={busy} onClick={undo}>Remove</button>
        </div>
      )}
    </li>
  )
}

// Staff cover: who is away on a day, and who covers each of their lessons.
export default function Cover() {
  const [date, setDate] = useState(isoDay(new Date()))
  const [day, setDay] = useState(null)
  const [absences, setAbsences] = useState([])
  const [periods, setPeriods] = useState([])
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const [d, a] = await Promise.all([api.timetable.cover.day(date), api.timetable.absences.list({ date })])
      setDay(d)
      setAbsences(Array.isArray(a) ? a : [])
    } catch (err) {
      setError(err.message)
    }
  }, [date])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    api.timetable.periods.list().then((p) => setPeriods((Array.isArray(p) ? p : []).filter((x) => !x.is_break))).catch(() => setPeriods([]))
  }, [])

  async function removeAbsence(a) {
    if (!window.confirm(`Remove ${a.teacher_name}'s absence? Cover arranged for their lessons in that time is removed too.`)) return
    try {
      await api.timetable.absences.remove(a.id)
      setNotice(`${a.teacher_name}'s absence was removed.`)
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }

  const changed = (message) => { setNotice(message); setError(''); load() }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Cover</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Record who is away, then choose who covers each of their lessons.</p>
        </div>
        <button type="button" style={{ width: 'auto' }} onClick={() => setAdding(true)}>Record an absence</button>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      {adding && day && (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Record an absence</h3>
          <AbsenceForm staff={day.staff || []} periods={periods} date={date}
            onSaved={() => { setAdding(false); changed('Absence recorded. Their lessons that need cover are listed below.') }}
            onCancel={() => setAdding(false)} />
        </div>
      )}

      <div className="card cover-day">
        <div className="cover-day-nav">
          <button type="button" className="secondary" style={{ width: 'auto' }} aria-label="Previous day" onClick={() => setDate(shift(date, -1))}>‹</button>
          <input type="date" aria-label="Day" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
          <button type="button" className="secondary" style={{ width: 'auto' }} aria-label="Next day" onClick={() => setDate(shift(date, 1))}>›</button>
          {date !== isoDay(new Date()) && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => setDate(isoDay(new Date()))}>Today</button>}
          {day?.school_day && day.total > 0 && (
            <span className={`badge ${day.covered === day.total ? 'finalized' : 'pending'}`}>{day.covered} of {day.total} covered</span>
          )}
        </div>
        {!day ? <p className="text-muted">Loading…</p> : !day.school_day ? (
          <p className="text-muted" style={{ margin: 0 }}>{formatDate(date, { weekday: 'long' })} isn&apos;t a school day.</p>
        ) : (
          <>
            <h3 className="cover-sub">Away</h3>
            {absences.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>Nobody is recorded as away on {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}.</p> : (
              <ul className="support-list">
                {absences.map((a) => (
                  <li key={a.id} className="support-row">
                    <span><strong>{a.teacher_name}</strong> <span className="text-muted">· {a.reason_label} · {a.start_date === a.end_date ? formatDate(a.start_date) : `${formatDate(a.start_date)} to ${formatDate(a.end_date)}`}{a.periods.length ? ` · ${a.periods.length} lesson${a.periods.length === 1 ? '' : 's'}` : ''}{a.note ? ` · ${a.note}` : ''}</span></span>
                    <button type="button" className="link-button" style={{ width: 'auto' }} aria-label={`Remove ${a.teacher_name}'s absence`} onClick={() => removeAbsence(a)}>Remove</button>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="cover-sub">Lessons that need cover</h3>
            {day.lessons.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None.</p> : (
              <ul className="cover-list">
                {day.lessons.map((row) => <CoverRow key={`${row.id}-${date}-${row.cover?.teacher ?? ''}`} row={row} date={date} onChanged={changed} onError={setError} />)}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

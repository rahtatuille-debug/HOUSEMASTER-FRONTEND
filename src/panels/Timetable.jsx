import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'
import WeekGrid from './WeekGrid.jsx'

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function errorText(err) {
  const data = err?.data
  if (data && typeof data === 'object') {
    const all = Object.values(data).flat().filter((v) => typeof v === 'string')
    if (all.length) return all.join(' ')
  }
  return err?.message || 'Something went wrong.'
}

// Add, change or remove one lesson. New lessons default to the teacher who
// teaches that subject to the class on the Staff page.
function LessonForm({ slot, options, schoolClass, onSaved, onCancel }) {
  const lesson = slot.lesson
  const [form, setForm] = useState({
    subject: lesson?.subject ?? '', title: lesson?.title ?? '', teacher: lesson ? (lesson.teacher ?? '') : 'auto',
    room: lesson?.room ?? '', double: false, teacher2: 'same', room2: 'same',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm({ ...form, [key]: key === 'double' ? e.target.checked : e.target.value })
  // The second period of a double lesson can have its own teacher or room ('same': as the first).
  const pick = (value) => (value ? Number(value) : null)
  const when = `${DAY_NAMES[slot.day - 1]} · ${slot.period.name} (${slot.period.start_time}–${slot.period.end_time})`

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const body = {
      subject: form.subject ? Number(form.subject) : null, title: form.title.trim(),
      room: form.room ? Number(form.room) : null,
    }
    if (form.teacher !== 'auto') body.teacher = form.teacher ? Number(form.teacher) : null
    try {
      if (lesson) {
        await api.timetable.lessons.update(lesson.id, body)
        onSaved('Lesson changed.')
        return
      }
      const add = (period, extra = {}) => api.timetable.lessons.create({ ...body, ...extra, school_class: schoolClass, day: slot.day, period: period.id })
      await add(slot.period)
      if (form.double && slot.next) {
        const second = {
          ...(form.teacher2 !== 'same' ? { teacher: pick(form.teacher2) } : {}),
          ...(form.room2 !== 'same' ? { room: pick(form.room2) } : {}),
        }
        try {
          await add(slot.next, second)
          onSaved(`Double lesson added (${slot.period.name} and ${slot.next.name}).`)
        } catch (err) {
          onSaved(`Lesson added in ${slot.period.name}, but not in ${slot.next.name}: ${errorText(err)}`)
        }
        return
      }
      onSaved('Lesson added.')
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.timetable.lessons.remove(lesson.id)
      onSaved('Lesson removed.')
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <div className="card tt-form">
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>{lesson ? `Change ${lesson.label}` : 'Add a lesson'}</h3>
      <p className="hint" style={{ marginTop: 0 }}>{when}</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <form onSubmit={save} className="tt-form-grid">
        <label>Subject
          <select value={form.subject} onChange={set('subject')}>
            <option value="">No subject (give it a title)</option>
            {options.subjects.map((s) => <option key={s.id} value={s.id}>{s.label || s.name}</option>)}
          </select>
        </label>
        {!form.subject && (
          <label>Title
            <input value={form.title} onChange={set('title')} placeholder="e.g. Assembly, Games, Study period" />
          </label>
        )}
        <label>Teacher
          <select value={form.teacher} onChange={set('teacher')}>
            {!lesson && <option value="auto">Whoever teaches it (Staff page)</option>}
            <option value="">No teacher</option>
            {options.staff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label>Room
          <select value={form.room} onChange={set('room')}>
            <option value="">No room</option>
            {options.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        {!lesson && slot.next && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.double} onChange={set('double')} />
            Double lesson (also {slot.next.name})
          </label>
        )}
        {!lesson && slot.next && form.double && (
          <>
            <label>Teacher in {slot.next.name}
              <select value={form.teacher2} onChange={set('teacher2')}>
                <option value="same">The same</option>
                <option value="">No teacher</option>
                {options.staff.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
            <label>Room in {slot.next.name}
              <select value={form.room2} onChange={set('room2')}>
                <option value="same">The same</option>
                <option value="">No room</option>
                {options.rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          </>
        )}
        <div className="tt-form-actions">
          <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : lesson ? 'Save' : 'Add lesson'}</button>
          {lesson && <button type="button" className="secondary" disabled={busy} style={{ width: 'auto' }} onClick={remove}>Remove</button>}
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </div>
  )
}

// Admins: the teaching days, the periods of the day and the rooms.
function SchoolDaySetup({ onChanged }) {
  const [days, setDays] = useState([])
  const [periods, setPeriods] = useState([])
  const [rooms, setRooms] = useState([])
  const [standard, setStandard] = useState({ start: '08:00', lesson_minutes: 40, lessons: 8, break_after: 2, lunch_after: 5 })
  const [newRoom, setNewRoom] = useState('')
  const [newPeriod, setNewPeriod] = useState({ name: '', start_time: '', end_time: '', is_break: false })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    const [w, p, r] = await Promise.all([api.timetable.schoolWeek.get(), api.timetable.periods.list(), api.timetable.rooms.list()])
    setDays(w.days)
    setPeriods(p)
    setRooms(r)
  }, [])
  useEffect(() => { load().catch((err) => setError(errorText(err))) }, [load])

  async function run(fn, message) {
    setError('')
    setNotice('')
    try {
      await fn()
      await load()
      setNotice(message)
      onChanged()
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }

  const toggleDay = (d) => run(() => api.timetable.schoolWeek.update(
    days.includes(d) ? days.filter((x) => x !== d) : [...days, d]), 'Teaching days saved.')
  const useStandard = (e) => {
    e.preventDefault()
    const breaks = [
      { after: Number(standard.break_after), minutes: 20, name: 'Break' },
      { after: Number(standard.lunch_after), minutes: 60, name: 'Lunch' },
    ].filter((b) => b.after > 0)
    run(() => api.timetable.periods.standard({
      start: standard.start, lesson_minutes: Number(standard.lesson_minutes), lessons: Number(standard.lessons), breaks,
    }), 'The school day is set up.')
  }
  const addPeriod = (e) => {
    e.preventDefault()
    run(() => api.timetable.periods.create(newPeriod), `${newPeriod.name} added.`)
      .then((ok) => ok && setNewPeriod({ name: '', start_time: '', end_time: '', is_break: false }))
  }
  const addRoom = (e) => {
    e.preventDefault()
    run(() => api.timetable.rooms.create({ name: newRoom }), `${newRoom} added.`).then((ok) => ok && setNewRoom(''))
  }
  const sp = (key) => (e) => setStandard({ ...standard, [key]: e.target.value })
  const np = (key) => (e) => setNewPeriod({ ...newPeriod, [key]: key === 'is_break' ? e.target.checked : e.target.value })

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>School day and rooms</h3>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      <p style={{ margin: '8px 0 4px' }}><strong>Teaching days</strong></p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {DAY_NAMES.map((name, i) => (
          <label key={name} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={days.includes(i + 1)} onChange={() => toggleDay(i + 1)} />
            {name.slice(0, 3)}
          </label>
        ))}
      </div>

      <p style={{ margin: '16px 0 4px' }}><strong>Periods</strong></p>
      {periods.length === 0 ? (
        <form onSubmit={useStandard} className="tt-form-grid">
          <p className="hint" style={{ gridColumn: '1 / -1', margin: 0 }}>Start with a standard day, then change any period below.</p>
          <label>Day starts<input type="time" value={standard.start} onChange={sp('start')} /></label>
          <label>Lesson length (minutes)<input type="number" min="10" max="120" value={standard.lesson_minutes} onChange={sp('lesson_minutes')} /></label>
          <label>Lessons a day<input type="number" min="1" max="14" value={standard.lessons} onChange={sp('lessons')} /></label>
          <label>Break after lesson<input type="number" min="0" max="13" value={standard.break_after} onChange={sp('break_after')} /></label>
          <label>Lunch after lesson<input type="number" min="0" max="13" value={standard.lunch_after} onChange={sp('lunch_after')} /></label>
          <div className="tt-form-actions"><button type="submit" style={{ width: 'auto' }}>Set up the day</button></div>
        </form>
      ) : (
        <ul className="tt-setup-list">
          {periods.map((p) => (
            <li key={p.id}>
              <span><strong>{p.name}</strong> {p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}{p.is_break ? ' · break' : ''}</span>
              <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }}
                onClick={() => run(() => api.timetable.periods.remove(p.id), `${p.name} removed.`)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      {periods.length > 0 && (
        <form onSubmit={addPeriod} className="tt-form-grid" style={{ marginTop: 8 }}>
          <label>Name<input value={newPeriod.name} onChange={np('name')} placeholder="e.g. Lesson 9" required /></label>
          <label>Starts<input type="time" value={newPeriod.start_time} onChange={np('start_time')} required /></label>
          <label>Ends<input type="time" value={newPeriod.end_time} onChange={np('end_time')} required /></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={newPeriod.is_break} onChange={np('is_break')} />It&apos;s a break
          </label>
          <div className="tt-form-actions"><button type="submit" className="secondary" style={{ width: 'auto' }}>Add period</button></div>
        </form>
      )}
      <p className="hint">Removing a period removes its lessons too.</p>

      <p style={{ margin: '16px 0 4px' }}><strong>Rooms</strong></p>
      {rooms.length > 0 && (
        <ul className="tt-setup-list">
          {rooms.map((r) => (
            <li key={r.id}>
              <span>{r.name}</span>
              <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }}
                onClick={() => run(() => api.timetable.rooms.remove(r.id), `${r.name} removed.`)}>Remove</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={addRoom} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ flex: '1 1 200px' }}>New room<input value={newRoom} onChange={(e) => setNewRoom(e.target.value)} placeholder="e.g. Lab 1" required /></label>
        <button type="submit" className="secondary" style={{ width: 'auto' }}>Add room</button>
      </form>
    </div>
  )
}

// The timetable: a teacher's own week, or any class's, teacher's or room's.
// Admins place lessons by clicking a slot in a class's week.
export default function Timetable({ me }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [view, setView] = useState(isAdmin ? 'class' : 'mine')
  const [target, setTarget] = useState('')
  const [options, setOptions] = useState({ classes: [], staff: [], rooms: [], subjects: [] })
  const [week, setWeek] = useState(null)
  const [slot, setSlot] = useState(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [unstaffed, setUnstaffed] = useState([])
  const loadUnstaffed = useCallback(() => {
    if (isAdmin) api.timetable.unstaffed().then((rows) => setUnstaffed(Array.isArray(rows) ? rows : [])).catch(() => {})
  }, [isAdmin])
  useEffect(() => { loadUnstaffed() }, [loadUnstaffed])

  const loadOptions = useCallback(async () => {
    const [classes, subjects, rooms, staff] = await Promise.all([
      api.schoolClasses.list(), api.subjects.list(), api.timetable.rooms.list(), isAdmin ? api.staff.list() : Promise.resolve([]),
    ])
    setOptions({ classes, subjects, rooms, staff: staff.filter((s) => s.is_active !== false) })
    if (isAdmin && classes.length) setTarget((t) => t || String(classes[0].id))
  }, [isAdmin])

  const loadWeek = useCallback(async () => {
    if (view !== 'mine' && !target) return
    const params = view === 'mine' ? {} : { [view === 'class' ? 'school_class' : view]: target }
    setWeek(await api.timetable.week(params))
  }, [view, target])

  useEffect(() => { loadOptions().catch((err) => setError(errorText(err))) }, [loadOptions])
  useEffect(() => { loadWeek().catch((err) => setError(errorText(err))) }, [loadWeek])

  const choices = { class: options.classes, teacher: options.staff, room: options.rooms }[view] || []
  const views = [
    ...(isAdmin ? [] : [['mine', 'My timetable']]),
    ['class', words.class], ...(isAdmin ? [['teacher', 'Teacher']] : []), ['room', 'Room'],
    ...(isAdmin ? [['mine', 'My timetable']] : []),
  ]
  const editable = isAdmin && view === 'class'

  function pick(next) {
    setView(next)
    setSlot(null)
    setWeek(null)
    const list = { class: options.classes, teacher: options.staff, room: options.rooms }[next] || []
    setTarget(list[0] ? String(list[0].id) : '')
  }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Timetable</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>
            {editable ? 'Click + in a slot to add a lesson, or a lesson to change it. Clashes are refused.' : 'Who is teaching what, where and when.'}
          </p>
        </div>
        {isAdmin && (
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setSetupOpen(!setupOpen)}>
            {setupOpen ? 'Hide school day setup' : 'School day and rooms'}
          </button>
        )}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {setupOpen && <SchoolDaySetup onChanged={() => { loadOptions(); loadWeek() }} />}
      {unstaffed.length > 0 && (
        <details className="card support-box">
          <summary>Unstaffed lessons ({unstaffed.length})</summary>
          <p className="hint">Lessons with no teacher, or a teacher whose account was deactivated. Open the class's timetable and give each one a teacher.</p>
          <ul style={{ paddingLeft: 18 }}>
            {unstaffed.map((l) => (
              <li key={l.id}>{l.day_name} {l.period_name} · {l.class_name} {l.label}{l.teacher_name ? ` · ${l.teacher_name}` : ' · no teacher'}{l.room_name ? ` · ${l.room_name}` : ''}</li>
            ))}
          </ul>
        </details>
      )}

      <div className="card">
        <div className="tt-pickers">
          <div className="guardian-subtabs" role="tablist" aria-label="Show the timetable for">
            {views.map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={view === key}
                className={view === key ? 'active-filter' : 'secondary'} onClick={() => pick(key)}>{label}</button>
            ))}
          </div>
          {view !== 'mine' && (
            <select aria-label={`Choose a ${view === 'class' ? words.class.toLowerCase() : view}`} value={target}
              onChange={(e) => { setTarget(e.target.value); setSlot(null) }}>
              {choices.length === 0 && <option value="">None yet</option>}
              {choices.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        {slot && (
          <LessonForm key={`${slot.day}-${slot.period.id}-${slot.lesson?.id}`} slot={slot} options={options}
            schoolClass={Number(target)}
            onCancel={() => setSlot(null)}
            onSaved={(message) => { setSlot(null); setNotice(message); loadWeek() }} />
        )}
        {week ? (
          <WeekGrid week={week} show={view === 'class' ? 'teacher' : 'class'} editable={editable}
            onSlot={(day, period) => {
              setNotice('')
              const after = week.periods[week.periods.findIndex((p) => p.id === period.id) + 1]
              setSlot({ day, period, next: after && !after.is_break ? after : null })
            }}
            onLesson={(lesson) => {
              setNotice('')
              setSlot({ day: lesson.day, period: week.periods.find((p) => p.id === lesson.period), lesson })
            }} />
        ) : <p className="text-muted">Loading…</p>}
      </div>
    </div>
  )
}

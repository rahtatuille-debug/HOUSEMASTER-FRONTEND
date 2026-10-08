import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import { perms } from '../permissions.js'

export const KINDS = [['sport', 'Sport'], ['music', 'Music'], ['arts', 'Drama and art'], ['academic', 'Academic'],
  ['service', 'Service and volunteering'], ['club', 'Club or society'], ['other', 'Other']]
const VENUES = [['home', 'Home'], ['away', 'Away'], ['neutral', 'Neutral venue']]
const STATUSES = [['present', 'Present'], ['absent', 'Absent'], ['excused', 'Excused']]
const OUTCOME = { win: ['Won', 'finalized'], draw: ['Drew', 'pending'], loss: ['Lost', 'rejected'] }

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const time = (t) => (t ? t.slice(0, 5) : '')
const asList = (d) => (Array.isArray(d) ? d : d?.results || [])

// The score or result in words, e.g. "Won 3–1" or "3rd of 12 schools".
export function resultText(f) {
  const parts = []
  if (f.outcome) parts.push(`${OUTCOME[f.outcome][0]} ${f.our_score}–${f.their_score}`)
  if (f.result_note) parts.push(f.result_note)
  return parts.join(' · ')
}

// One fixture line: when, who against, where, and the result once it's in.
export function FixtureLine({ fixture: f, showClub = false, children }) {
  return (
    <li className="fixture-row">
      <div className="fixture-when"><strong>{formatDate(f.date, { day: 'numeric', month: 'short' })}</strong>{f.start_time && <span className="text-muted">{time(f.start_time)}</span>}</div>
      <div className="fixture-what">
        <strong>{showClub ? `${f.club_name}${f.team ? ` (${f.team})` : ''} v ${f.opponent}` : `v ${f.opponent}`}</strong>
        <span className="text-muted">{[!showClub && f.team, f.venue_label, f.location, f.competition].filter(Boolean).join(' · ')}</span>
        {(f.outcome || f.result_note) && (
          <span className={`badge ${f.outcome ? OUTCOME[f.outcome][1] : 'pending'} fixture-result`}>{resultText(f)}</span>
        )}
        {children}
      </div>
    </li>
  )
}

function ClubForm({ initial, staff, canChooseStaff, onSubmit, onCancel }) {
  const [form, setForm] = useState({ name: '', kind: 'club', meets: '', location: '', description: '', is_active: true,
    ...initial, leaders: (initial?.leader_ids || []).map(String) })
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })
  const toggle = (id) => setForm({ ...form, leaders: form.leaders.includes(id) ? form.leaders.filter((l) => l !== id) : [...form.leaders, id] })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    const body = { name: form.name, kind: form.kind, meets: form.meets, location: form.location, description: form.description, is_active: form.is_active }
    if (canChooseStaff) body.leaders = form.leaders.map(Number)
    try { await onSubmit(body) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="tt-form-grid discipline-form">
      <label>Name<input value={form.name} onChange={set('name')} maxLength={120} required placeholder="e.g. Under 15 football" /></label>
      <label>Kind
        <select value={form.kind} onChange={set('kind')}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>When it meets<input value={form.meets} onChange={set('meets')} maxLength={120} placeholder="e.g. Tuesdays 3:30pm" /></label>
      <label>Where<input value={form.location} onChange={set('location')} maxLength={120} placeholder="e.g. Main field" /></label>
      <label className="span-all">About it (parents don&apos;t see this)
        <textarea rows={2} value={form.description} onChange={set('description')} maxLength={2000} />
      </label>
      {canChooseStaff && (
        <fieldset className="span-all" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="hint" style={{ marginBottom: 4 }}>Staff who run it (they manage members, registers and fixtures)</legend>
          <div className="checkbox-list">
            {staff.map((s) => (
              <label key={s.id}><input type="checkbox" checked={form.leaders.includes(String(s.id))} onChange={() => toggle(String(s.id))} /> {s.name}</label>
            ))}
          </div>
        </fieldset>
      )}
      {initial?.id && (
        <label className="span-all check-row"><input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Running this year (untick to hide it from parents)</label>
      )}
      <div className="tt-form-actions">
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : initial?.id ? 'Save' : 'Add club'}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function Members({ club, onChanged, setError, setNotice }) {
  const [rows, setRows] = useState(null)
  const [query, setQuery] = useState('')
  const [found, setFound] = useState([])
  const [roleFor, setRoleFor] = useState(null)
  const [role, setRole] = useState('')
  const load = useCallback(() => api.clubs.members(club.id).then((r) => setRows(asList(r))).catch((e) => setError(e.message)), [club.id, setError])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!club.can_manage || query.trim().length < 2) { setFound([]); return undefined }
    const t = setTimeout(() => api.clubs.candidates(club.id, query.trim()).then((r) => setFound(asList(r))).catch(() => setFound([])), 250)
    return () => clearTimeout(t)
  }, [query, club.id, club.can_manage])

  async function act(fn, message) {
    setError('')
    try {
      await fn()
      setNotice(message)
      await load()
      onChanged()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  const add = (s) => act(() => api.clubs.addMembers(club.id, { students: [s.student] }), `${s.name} joined ${club.name}.`).then(() => { setQuery(''); setFound([]) })
  const saveRole = (r) => act(() => api.clubs.updateMember(club.id, r.student, { role }), `Saved ${r.name}'s role.`).then(() => setRoleFor(null))
  const remove = (r) => {
    if (!window.confirm(`Take ${r.name} out of ${club.name}? Their past registers stay.`)) return
    act(() => api.clubs.removeMember(club.id, r.student), `${r.name} left ${club.name}.`)
  }
  return (
    <div>
      {club.can_manage && (
        <div className="club-add">
          <label htmlFor="club-add-search">Add a student</label>
          <input id="club-add-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a name or admission number" />
          {query.trim().length >= 2 && (
            found.length === 0 ? <p className="hint" style={{ margin: '4px 0 0' }}>No students match who aren&apos;t in the club.</p> : (
              <ul className="club-found">
                {found.map((s) => (
                  <li key={s.student}>
                    <span>{s.name}{s.class_name && <span className="text-muted"> · {s.class_name}</span>}</span>
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => add(s)} aria-label={`Add ${s.name}`}>Add</button>
                  </li>
                ))}
              </ul>
            )
          )}
        </div>
      )}
      {rows === null ? <p className="text-muted">Loading…</p> : rows.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>{club.can_manage ? 'Nobody in the club yet.' : 'None of your students are in this club.'}</p>
      ) : (
        <div className="table-scroll">
          <table className="dash-table club-members">
            <thead><tr><th>Student</th><th>Class</th><th>Role</th><th>Came</th>{club.can_manage && <th aria-label="Actions" />}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.student}>
                  <td>{r.name}</td>
                  <td>{r.class_name || '—'}</td>
                  <td>{roleFor === r.student ? (
                    <span className="club-role-edit">
                      <input aria-label={`Role for ${r.name}`} value={role} onChange={(e) => setRole(e.target.value)} maxLength={60} placeholder="e.g. Captain" />
                      <button type="button" style={{ width: 'auto' }} onClick={() => saveRole(r)}>Save</button>
                    </span>
                  ) : (r.role || <span className="text-muted">Member</span>)}</td>
                  <td>{r.attendance?.sessions ? `${r.attendance.present} of ${r.attendance.sessions}` : '—'}</td>
                  {club.can_manage && (
                    <td className="club-actions">
                      {roleFor !== r.student && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => { setRoleFor(r.student); setRole(r.role || '') }} aria-label={`Change ${r.name}'s role`}>Role</button>}
                      <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => remove(r)} aria-label={`Take ${r.name} out of the club`}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Register({ club, onChanged, setError, setNotice }) {
  const [date, setDate] = useState(isoDay(new Date()))
  const [data, setData] = useState(null)
  const [marks, setMarks] = useState({})
  const [note, setNote] = useState('')
  const [sessions, setSessions] = useState([])
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([api.clubs.register(club.id, date), api.clubs.sessions(club.id)])
      setData(r)
      setMarks(Object.fromEntries((r.students || []).map((x) => [x.student, x.status || ''])))
      setNote(r.note || '')
      setSessions(asList(s))
    } catch (err) {
      setError(fieldError(err))
    }
  }, [club.id, date, setError])
  useEffect(() => { load() }, [load])
  async function save() {
    setBusy(true)
    setError('')
    try {
      const list = Object.entries(marks).filter(([, s]) => s).map(([student, status]) => ({ student: Number(student), status }))
      await api.clubs.saveRegister(club.id, { date, note, marks: list })
      setNotice(`Register saved for ${formatDate(date)}.`)
      await load()
      onChanged()
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  const students = data?.students || []
  const marked = Object.values(marks).filter(Boolean).length
  return (
    <div>
      <div className="club-register-head">
        <label>Date<input type="date" value={date} max={isoDay(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} /></label>
        {students.length > 0 && <button type="button" className="secondary" style={{ width: 'auto' }}
          onClick={() => setMarks(Object.fromEntries(students.map((s) => [s.student, marks[s.student] || 'present'])))}>Everyone else present</button>}
        {data?.taken && <span className="badge finalized">Taken{data.taken_by_name ? ` by ${data.taken_by_name}` : ''}</span>}
      </div>
      {!data ? <p className="text-muted">Loading…</p> : students.length === 0 ? <p className="text-muted">Add members first.</p> : (
        <>
          <ul className="club-register">
            {students.map((s) => (
              <li key={s.student}>
                <span>{s.name}{s.role && <span className="text-muted"> · {s.role}</span>}{s.left && <span className="text-muted"> · left the club</span>}</span>
                <span className="club-marks" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                  {STATUSES.map(([v, l]) => (
                    <button key={v} type="button" role="radio" aria-checked={marks[s.student] === v}
                      className={marks[s.student] === v ? `mark-${v} active` : 'secondary'} style={{ width: 'auto' }}
                      onClick={() => setMarks({ ...marks, [s.student]: v })}>{l}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <label style={{ display: 'block', marginTop: 8 }}>Note (staff only, optional)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} /></label>
          <button type="button" style={{ width: 'auto', marginTop: 8 }} disabled={busy || marked === 0} onClick={save}>{busy ? 'Saving…' : `Save register (${marked} of ${students.length} marked)`}</button>
        </>
      )}
      {sessions.length > 0 && (
        <>
          <h3 className="cover-sub">Past registers</h3>
          <ul className="support-list">
            {sessions.slice(0, 12).map((s) => (
              <li key={s.id} className="support-row">
                <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => setDate(s.date)}>{formatDate(s.date)}</button>
                <span className="text-muted">{s.present} present · {s.absent} absent{s.excused ? ` · ${s.excused} excused` : ''}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const BLANK_FIXTURE = { date: '', start_time: '', opponent: '', venue: 'home', location: '', competition: '', team: '' }

function FixtureForm({ initial, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...BLANK_FIXTURE, date: isoDay(new Date()), ...initial, start_time: time(initial?.start_time) })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const [busy, setBusy] = useState(false)
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ date: form.date, start_time: form.start_time || null, opponent: form.opponent, venue: form.venue,
        location: form.location, competition: form.competition, team: form.team })
    } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="tt-form-grid discipline-form">
      <label>Against, or the event<input value={form.opponent} onChange={set('opponent')} maxLength={120} required placeholder="e.g. St Mary's School" /></label>
      <label>Date<input type="date" value={form.date} onChange={set('date')} required /></label>
      <label>Starts (optional)<input type="time" value={form.start_time} onChange={set('start_time')} /></label>
      <label>Home or away
        <select value={form.venue} onChange={set('venue')}>{VENUES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      </label>
      <label>Where (optional)<input value={form.location} onChange={set('location')} maxLength={200} /></label>
      <label>Team (optional)<input value={form.team} onChange={set('team')} maxLength={60} placeholder="e.g. Under 15 A" /></label>
      <label>Competition (optional)<input value={form.competition} onChange={set('competition')} maxLength={120} placeholder="e.g. County league" /></label>
      <div className="tt-form-actions">
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : initial?.id ? 'Save' : 'Add fixture'}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function ResultForm({ fixture, onSubmit, onCancel }) {
  const [form, setForm] = useState({ our_score: fixture.our_score ?? '', their_score: fixture.their_score ?? '', result_note: fixture.result_note || '', report: fixture.report || '' })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const num = (v) => (v === '' ? null : Number(v))
  return (
    <form className="tt-form-grid discipline-form" onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, our_score: num(form.our_score), their_score: num(form.their_score) }) }}>
      <label>Our score<input type="number" min={0} max={999} value={form.our_score} onChange={set('our_score')} /></label>
      <label>Their score<input type="number" min={0} max={999} value={form.their_score} onChange={set('their_score')} /></label>
      <label className="span-all">Or the result in words (optional)<input value={form.result_note} onChange={set('result_note')} maxLength={300} placeholder="e.g. 3rd of 12 schools, or Won on penalties" /></label>
      <label className="span-all">Short report (parents of the squad see it)<textarea rows={2} value={form.report} onChange={set('report')} maxLength={4000} /></label>
      <div className="tt-form-actions">
        <button type="submit" style={{ width: 'auto' }}>Save result</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

function SquadPicker({ fixture, members, onSubmit, onCancel }) {
  const [picked, setPicked] = useState(fixture.players.map((p) => p.id))
  const toggle = (id) => setPicked(picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id])
  return (
    <div className="club-squad">
      <p className="hint" style={{ margin: '0 0 4px' }}>Pick the squad. Their parents see that they were picked. {picked.length} picked.</p>
      <div className="checkbox-list">
        {members.map((m) => <label key={m.student}><input type="checkbox" checked={picked.includes(m.student)} onChange={() => toggle(m.student)} /> {m.name}</label>)}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button type="button" style={{ width: 'auto' }} onClick={() => onSubmit(picked)}>Save squad</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function Fixtures({ club, setError, setNotice }) {
  const [list, setList] = useState(null)
  const [members, setMembers] = useState([])
  const [open, setOpen] = useState(null) // "new", "edit-<id>", "result-<id>", "squad-<id>"
  const load = useCallback(async () => {
    try {
      setList(asList(await api.fixtures.list({ club: club.id })))
      if (club.can_manage) setMembers(asList(await api.clubs.members(club.id)))
    } catch (err) {
      setError(err.message)
    }
  }, [club.id, club.can_manage, setError])
  useEffect(() => { load() }, [load])
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
  const today = isoDay(new Date())
  const rows = list || []
  const upcoming = rows.filter((f) => f.date >= today && !f.outcome && !f.result_note)
  const past = rows.filter((f) => !upcoming.includes(f)).sort((a, b) => b.date.localeCompare(a.date))
  const remove = (f) => window.confirm(`Remove the fixture against ${f.opponent}?`) && act(() => api.fixtures.remove(f.id), 'Fixture removed.')
  const line = (f) => open === `edit-${f.id}` ? (
    <li key={f.id}><FixtureForm initial={f} onSubmit={(body) => act(() => api.fixtures.update(f.id, body), 'Saved.')} onCancel={() => setOpen(null)} /></li>
  ) : (
    <FixtureLine key={f.id} fixture={f}>
      {f.players?.length > 0 && <span className="hint club-squad-names">Squad: {f.players.map((p) => p.name).join(', ')}</span>}
      {f.report && <span className="hint">{f.report}</span>}
      {open === `result-${f.id}` && <ResultForm fixture={f} onSubmit={(body) => act(() => api.fixtures.update(f.id, body), `Result saved for v ${f.opponent}.`)} onCancel={() => setOpen(null)} />}
      {open === `squad-${f.id}` && <SquadPicker fixture={f} members={members} onSubmit={(ids) => act(() => api.fixtures.update(f.id, { players: ids }), 'Squad saved.')} onCancel={() => setOpen(null)} />}
      {f.can_manage && !open?.endsWith(`-${f.id}`) && (
        <span className="support-actions">
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(`result-${f.id}`)} aria-label={`Result v ${f.opponent}`}>{f.outcome || f.result_note ? 'Change result' : 'Add result'}</button>
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(`squad-${f.id}`)} aria-label={`Squad v ${f.opponent}`}>Squad</button>
          <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => setOpen(`edit-${f.id}`)}>Edit</button>
          <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => remove(f)}>Remove</button>
        </span>
      )}
    </FixtureLine>
  )
  return (
    <div>
      {club.can_manage && open !== 'new' && <button type="button" style={{ width: 'auto', marginBottom: 8 }} onClick={() => setOpen('new')}>Add a fixture</button>}
      {open === 'new' && <div className="card"><FixtureForm onSubmit={(body) => act(() => api.fixtures.create({ ...body, club: club.id }), 'Fixture added.')} onCancel={() => setOpen(null)} /></div>}
      {list === null ? <p className="text-muted">Loading…</p> : (
        <>
          <h3 className="cover-sub">Coming up</h3>
          {upcoming.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>Nothing planned.</p> : <ul className="fixture-list">{upcoming.map(line)}</ul>}
          <h3 className="cover-sub">Results</h3>
          {past.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No results yet.</p> : <ul className="fixture-list">{past.map(line)}</ul>}
        </>
      )}
    </div>
  )
}

function ClubPage({ club, me, staff, onBack, onChanged }) {
  const [tab, setTab] = useState('members')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const leader = perms(me).is_leader
  const tabs = [['members', 'Members'], ...(club.can_manage ? [['register', 'Register']] : []), ['fixtures', 'Fixtures and results']]
  async function save(body) {
    setError('')
    try {
      await api.clubs.update(club.id, body)
      setEditing(false)
      setNotice('Saved.')
      onChanged()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  async function remove() {
    if (!window.confirm(`Remove ${club.name} with its members, registers and fixtures? This can't be undone.`)) return
    try {
      await api.clubs.remove(club.id)
      onChanged()
      onBack(`${club.name} was removed.`)
    } catch (err) {
      setError(fieldError(err))
    }
  }
  return (
    <div>
      <button type="button" className="link-button back-button" style={{ width: 'auto' }} onClick={() => onBack()}>← All clubs</button>
      <div className="panel-header">
        <div>
          <h2>{club.name}{!club.is_active && <span className="badge draft" style={{ marginLeft: 8 }}>Not running</span>}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>{[club.kind_label, club.meets, club.location, club.leaders.length ? `Run by ${club.leaders.join(', ')}` : 'No staff chosen yet'].filter(Boolean).join(' · ')}</p>
        </div>
        {club.can_manage && !editing && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setEditing(true)}>Edit club</button>
            {leader && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={remove}>Remove</button>}
          </div>
        )}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {editing && <div className="card"><ClubForm initial={club} staff={staff} canChooseStaff={leader} onSubmit={save} onCancel={() => setEditing(false)} /></div>}
      {club.description && !editing && <p style={{ marginTop: 0 }}>{club.description}</p>}
      <div className="scope-tabs filter-row" role="tablist" aria-label={club.name}>
        {tabs.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={`secondary${tab === key ? ' active' : ''}`}
            onClick={() => { setTab(key); setNotice('') }}>{label}</button>
        ))}
      </div>
      <div className="card">
        {tab === 'members' && <Members club={club} onChanged={onChanged} setError={setError} setNotice={setNotice} />}
        {tab === 'register' && <Register club={club} onChanged={onChanged} setError={setError} setNotice={setNotice} />}
        {tab === 'fixtures' && <Fixtures club={club} setError={setError} setNotice={setNotice} />}
      </div>
    </div>
  )
}

// Clubs and activities: teams, clubs and societies, their members,
// registers, fixtures and results.
export default function Clubs({ me }) {
  const leader = perms(me).is_leader
  const [clubs, setClubs] = useState(null)
  const [mine, setMine] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [staff, setStaff] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const [c, u, r] = await Promise.all([api.clubs.list(), api.fixtures.list({ upcoming: 1 }), api.fixtures.list({ results: 1 })])
      setClubs(asList(c))
      setUpcoming(asList(u).slice(0, 8))
      setResults(asList(r).slice(0, 8))
    } catch (err) {
      setError(err.message)
    }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (leader) api.clubs.staff().then((s) => setStaff(asList(s))).catch(() => setStaff([]))
  }, [leader])

  async function add(body) {
    setError('')
    try {
      const club = await api.clubs.create(body)
      setAdding(false)
      setNotice(`${club.name} was added.`)
      await load()
    } catch (err) {
      setError(fieldError(err))
    }
  }

  const open = clubs?.find((c) => c.id === openId)
  if (open) {
    return <ClubPage club={open} me={me} staff={staff} onChanged={load}
      onBack={(message) => { setOpenId(null); setNotice(message || '') }} />
  }
  const shown = (clubs || []).filter((c) => !mine || c.can_manage)
  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Clubs and activities</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Teams, clubs and societies: who is in them, registers, fixtures and results.</p>
        </div>
        {leader && <button type="button" style={{ width: 'auto' }} onClick={() => setAdding(true)}>Add a club</button>}
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {adding && <div className="card"><h3 style={{ fontSize: 15, marginBottom: 8 }}>Add a club</h3><ClubForm staff={staff} canChooseStaff={leader} onSubmit={add} onCancel={() => setAdding(false)} /></div>}

      {clubs === null ? <p className="text-muted">Loading…</p> : (
        <>
          {clubs.some((c) => c.can_manage) && !leader && (
            <div className="scope-tabs filter-row" role="tablist" aria-label="Which clubs">
              {[[false, 'All clubs'], [true, 'Clubs I run']].map(([value, label]) => (
                <button key={label} type="button" role="tab" aria-selected={mine === value} className={`secondary${mine === value ? ' active' : ''}`} onClick={() => setMine(value)}>{label}</button>
              ))}
            </div>
          )}
          {shown.length === 0 ? (
            <div className="card"><p className="text-muted" style={{ margin: 0 }}>{leader ? 'No clubs yet. Add the first one: a team, a club or a society.' : 'No clubs have been set up yet.'}</p></div>
          ) : (
            <div className="club-grid">
              {shown.map((c) => (
                <button key={c.id} type="button" className={`club-card${c.is_active ? '' : ' inactive'}`} onClick={() => { setOpenId(c.id); setNotice('') }}>
                  <span className="club-kind">{c.kind_label}{c.can_manage ? ' · You run this' : ''}</span>
                  <strong>{c.name}</strong>
                  <span className="text-muted">{[c.meets, plural(c.member_count, 'member')].filter(Boolean).join(' · ')}</span>
                  {!c.is_active && <span className="badge draft">Not running</span>}
                </button>
              ))}
            </div>
          )}
          <div className="club-boards">
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Coming up</h3>
              {upcoming.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No fixtures planned.</p> : <ul className="fixture-list">{upcoming.map((f) => <FixtureLine key={f.id} fixture={f} showClub />)}</ul>}
            </div>
            <div className="card">
              <h3 style={{ fontSize: 15, marginBottom: 8 }}>Latest results</h3>
              {results.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No results yet.</p> : <ul className="fixture-list">{results.map((f) => <FixtureLine key={f.id} fixture={f} showClub />)}</ul>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

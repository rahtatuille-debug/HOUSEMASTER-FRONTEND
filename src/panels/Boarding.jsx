import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { useRemembered } from '../remember.js'
import { formatDate, formatDateTime } from '../format.js'
import { errorText } from './Timetable.jsx'
import StudentSelect from './StudentSelect.jsx'

const SHORT = { dateStyle: 'medium', timeStyle: 'short' }
const WHERE = { in: ['In the house', 'finalized'], on_leave: ['On leave', 'pending'], sick_bay: ['In sick bay', 'draft'] }
const ROLL_STATUS = { present: 'Present', missing: 'Missing', on_leave: 'On leave', sick_bay: 'In sick bay' }
const LEAVE_KINDS = [['weekend', 'Weekend'], ['half_term', 'Half term'], ['exeat', 'Exeat'], ['appointment', 'Appointment'], ['other', 'Other']]
const OUTCOMES = [['back', 'Back to lessons or the house'], ['home', 'Sent home'], ['hospital', 'Sent to hospital or a clinic']]
const RESOLUTIONS = [['found', 'Found'], ['returned', 'Came back'], ['on_leave', 'Was on authorised leave'], ['left_school', 'Has left the school']]
// Boarder dropdowns show (and search) the house after the name.
const BOARDER_HOUSE = (b) => (b.house ? `(${b.house})` : '')
const BOARDER_SEARCH = 'Type a name or house'
const SUBTABS = [['today', 'Today'], ['roll', 'Roll call'], ['leave', 'Leave'], ['sick', 'Sick bay'], ['houses', 'Boarding houses and beds'], ['allocation', 'House allocation']]

function defaultSession() {
  const hour = new Date().getHours()
  return hour < 12 ? 'morning' : hour < 20 ? 'evening' : 'night'
}

function useLoader(load) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const reload = useCallback(() => load().then(setData).catch((err) => setError(errorText(err))), [load])
  useEffect(() => { reload() }, [reload])
  return [data, reload, error, setError]
}

function Banner({ error, notice }) {
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
    </>
  )
}

// A boarder marked missing stays on this list, oldest first, until someone records how it was resolved.
function MissingBoarders({ missing, onGo, onResolved }) {
  const [open, setOpen] = useState(null)
  const [resolution, setResolution] = useState('found')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  async function save(m) {
    setError('')
    try {
      await api.boarding.absences.resolve(m.id, resolution, note)
      setNotice(`${m.name}: recorded.`)
      setOpen(null)
      onResolved()
    } catch (err) {
      setError(errorText(err))
    }
  }
  return (
    <>
      <Banner error={error} notice={notice} />
      {missing.length > 0 && (
        <div className="card support-box" style={{ borderLeftColor: 'var(--stamp-red)' }} role="region" aria-label="Missing boarders">
          <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Missing: not found yet</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {missing.map((m) => (
              <li key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.name}</strong> · {m.house} · {m.when}{m.note ? ` · ${m.note}` : ''}
                <span className="text-muted"> · missing since {formatDateTime(m.since, SHORT)}</span>{' '}
                {open === m.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); save(m) }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 6 }}>
                    <label style={{ flex: '1 1 180px' }}>How was it resolved?
                      <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
                        {RESOLUTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <label style={{ flex: '2 1 220px' }}>Note (optional)<input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></label>
                    <button type="submit" style={{ width: 'auto' }}>Save</button>
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(null)}>Cancel</button>
                  </form>
                ) : (
                  <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} aria-label={`Record ${m.name} as found`}
                    onClick={() => { setOpen(m.id); setResolution('found'); setNote('') }}>Found</button>
                )}
              </li>
            ))}
          </ul>
          <p className="hint" style={{ marginBottom: 0 }}>They stay here until someone records them found, even after the next roll call.</p>
          <button type="button" className="secondary" style={{ width: 'auto', marginTop: 8 }} onClick={() => onGo('roll')}>Take a roll call</button>
        </div>
      )}
    </>
  )
}

// --- Today: numbers, who's missing, and every boarder with where they are now.
function Today({ onGo }) {
  const [overview, reloadOverview, error] = useLoader(useCallback(() => api.boarding.overview(), []))
  const [boarders] = useLoader(useCallback(() => api.boarding.boarders(), []))
  const [unbedded] = useLoader(useCallback(() => api.boarding.unbedded(), []))
  const [query, setQuery] = useState('')
  if (!overview) return error ? <Banner error={error} /> : <p className="text-muted">Loading…</p>
  const shown = (boarders || []).filter((b) => !query || `${b.name} ${b.dorm} ${b.class_name}`.toLowerCase().includes(query.toLowerCase()))
  const tiles = [['Boarders', overview.boarders], ['On leave', overview.on_leave], ['In sick bay', overview.sick_bay],
    ['Leave to decide', overview.leave_waiting], ['Free beds', overview.beds_free],
    ...(overview.unbedded ? [['Without a bed', overview.unbedded]] : [])]
  return (
    <>
      <div className="stat-row">
        {tiles.map(([label, value]) => (
          <div className="stat-tile" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div></div>
        ))}
      </div>
      <MissingBoarders missing={overview.missing} onGo={onGo} onResolved={reloadOverview} />
      {unbedded?.length > 0 && (
        <div className="card support-box" role="region" aria-label="Boarders without a bed">
          <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Boarders without a bed</h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {unbedded.map((s) => <li key={s.id}><strong>{s.name}</strong>{s.class_name ? ` · ${s.class_name}` : ''}</li>)}
          </ul>
          <button type="button" className="secondary" style={{ width: 'auto', marginTop: 8 }} onClick={() => onGo('houses')}>Put them in beds</button>
        </div>
      )}
      {overview.leave_waiting > 0 && (
        <p><button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => onGo('leave')}>
          {overview.leave_waiting} leave request{overview.leave_waiting === 1 ? '' : 's'} waiting for a decision
        </button></p>
      )}
      <div className="card">
        <div className="support-row">
          <h3 style={{ fontSize: 15, margin: 0 }}>Boarders</h3>
          <input type="search" aria-label="Find a boarder" placeholder="Find a boarder" value={query}
            onChange={(e) => setQuery(e.target.value)} style={{ maxWidth: 260 }} />
        </div>
        {!boarders ? <p className="text-muted">Loading…</p> : shown.length === 0 ? <p className="text-muted">No boarders yet. Put students in beds on Boarding houses and beds.</p> : (
          <table className="data-table" style={{ marginTop: 8 }}>
            <thead><tr><th>Name</th><th>Class</th><th>Boarding house</th><th>Dorm and bed</th><th>Now</th></tr></thead>
            <tbody>
              {shown.map((b) => (
                <tr key={b.id}>
                  <td className="row-title">{b.name}</td><td data-label="Class">{b.class_name || '—'}</td>
                  <td data-label="Boarding house">{b.house}</td><td data-label="Dorm">{b.dorm} · {b.bed}</td>
                  <td data-label="Now"><span className={`badge ${WHERE[b.where][1]}`}>{WHERE[b.where][0]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// A finished roll call is locked. An admin can correct it, giving a reason; the change is kept on the roll call.
function AmendRollCall({ id, onClose, onSaved }) {
  const [roll, setRoll] = useState(null)
  const [statuses, setStatuses] = useState({})
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    api.boarding.rollCalls.get(id).then((r) => { setRoll(r); setStatuses(Object.fromEntries(r.entries.map((e) => [e.student, e.status]))) })
      .catch((err) => setError(errorText(err)))
  }, [id])
  async function save(e) {
    e.preventDefault()
    setError('')
    const entries = roll.entries.filter((x) => statuses[x.student] !== x.status).map((x) => ({ student: x.student, status: statuses[x.student] }))
    if (!entries.length) { setError('Change at least one boarder first.'); return }
    if (!reason.trim()) { setError('Say why the roll call is being changed.'); return }
    try {
      const updated = await api.boarding.rollCalls.amend(id, entries, reason.trim())
      setRoll(updated)
      setReason('')
      onSaved()
    } catch (err) {
      setError(errorText(err))
    }
  }
  if (!roll) return error ? <Banner error={error} /> : <p className="text-muted">Loading…</p>
  return (
    <form className="card" onSubmit={save}>
      <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>Amend {roll.house_name} · {roll.session_label} · {formatDate(roll.date)}</h3>
      <p className="hint" style={{ marginTop: 0 }}>This roll call is finished. Changes are recorded with your name, the reason, and what each boarder was before.</p>
      <Banner error={error} />
      <div className="form-row">
        {roll.entries.map((x) => (
          <label key={x.student} style={{ flex: '1 1 200px' }}>{x.name}
            <select value={statuses[x.student] || ''} onChange={(e) => setStatuses({ ...statuses, [x.student]: e.target.value })}>
              {Object.entries(ROLL_STATUS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        ))}
      </div>
      <label>Why is it being changed?<input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} /></label>
      <div className="tt-form-actions">
        <button type="submit" style={{ width: 'auto' }}>Save the change</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onClose}>Close</button>
      </div>
      {roll.amendments?.length > 0 && (
        <ul className="hint" style={{ paddingLeft: 18 }}>
          {roll.amendments.map((a, i) => (
            <li key={i}>Amended by {a.by || 'an admin'} on {formatDateTime(a.at, SHORT)}: {a.reason} ({a.changes.length} change{a.changes.length === 1 ? '' : 's'})</li>
          ))}
        </ul>
      )}
    </form>
  )
}

// --- Roll call: start one for a house, mark each boarder, finish.
function RollCallPanel({ houses, me }) {
  const isAdmin = me?.role === 'admin'
  const [amending, setAmending] = useState(null)
  const [house, setHouse] = useState(houses[0]?.id || '')
  const [session, setSession] = useState(defaultSession())
  const [roll, setRoll] = useState(null)
  const [recent, reloadRecent] = useLoader(useCallback(() => api.boarding.rollCalls.list(), []))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function run(fn) {
    setError('')
    setNotice('')
    try {
      return await fn()
    } catch (err) {
      setError(errorText(err))
      return null
    }
  }
  const start = () => run(async () => setRoll(await api.boarding.rollCalls.start(Number(house), session)))
  const mark = (entries, complete = false) => run(async () => {
    const updated = await api.boarding.rollCalls.mark(roll.id, entries, complete)
    setRoll(updated)
    if (complete) {
      setNotice(`Roll call finished: ${updated.counts.missing ? `${updated.counts.missing} missing.` : 'nobody missing.'}`)
      setRoll(null)
      reloadRecent()
    }
  })
  const rest = roll ? roll.entries.filter((e) => !e.status).map((e) => ({ student: e.student, status: 'present' })) : []

  return (
    <>
      <Banner error={error} notice={notice} />
      {!roll ? (
        <div className="card">
          <div className="tt-form-grid">
            <label>Boarding house
              <select value={house} onChange={(e) => setHouse(e.target.value)}>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </label>
            <label>Roll call
              <select value={session} onChange={(e) => setSession(e.target.value)}>
                <option value="morning">Morning</option><option value="evening">Evening</option><option value="night">Night</option>
              </select>
            </label>
            <div className="tt-form-actions"><button type="button" style={{ width: 'auto' }} onClick={start} disabled={!house}>Start roll call</button></div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="support-row">
            <h3 style={{ fontSize: 15, margin: 0 }}>{roll.house_name} · {roll.session_label} · {formatDate(roll.date)}</h3>
            {rest.length > 0 && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => mark(rest)}>Mark the rest present</button>}
          </div>
          <ul className="support-list">
            {roll.entries.map((e) => (
              <li key={e.student}>
                <div className="support-row">
                  <div><strong>{e.name}</strong> <span className="text-muted">· {e.dorm}</span>
                    {e.status && <span className={`badge ${e.status === 'missing' ? 'rejected' : e.status === 'present' ? 'finalized' : 'pending'}`} style={{ marginLeft: 8 }}>{ROLL_STATUS[e.status]}</span>}
                  </div>
                  <div className="support-actions">
                    <button type="button" className={e.status === 'present' ? '' : 'secondary'} style={{ width: 'auto' }}
                      onClick={() => mark([{ student: e.student, status: 'present' }])}>Present</button>
                    <button type="button" className={e.status === 'missing' ? '' : 'secondary'} style={{ width: 'auto' }}
                      onClick={() => mark([{ student: e.student, status: 'missing' }])}>Missing</button>
                  </div>
                </div>
                {e.status === 'missing' && (
                  <input aria-label={`Note about ${e.name}`} placeholder="Note (optional)" defaultValue={e.note} style={{ marginTop: 6 }}
                    onBlur={(ev) => ev.target.value !== e.note && mark([{ student: e.student, note: ev.target.value }])} />
                )}
              </li>
            ))}
          </ul>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" style={{ width: 'auto' }} onClick={() => mark([], true)}>Finish roll call</button>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setRoll(null)}>Come back to it later</button>
          </div>
        </div>
      )}
      {amending && <AmendRollCall key={amending} id={amending} onClose={() => setAmending(null)} onSaved={reloadRecent} />}
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Recent roll calls</h3>
        {!recent ? <p className="text-muted">Loading…</p> : recent.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None yet.</p> : (
          <ul className="tt-setup-list">
            {recent.slice(0, 12).map((r) => (
              <li key={r.id}>
                <span>{r.house_name} · {r.session_label} · {formatDate(r.date)}{r.completed_at ? '' : ' · not finished'}
                  {r.amendments?.length > 0 && <span className="text-muted"> · amended</span>}</span>
                <span>
                  <span className={r.counts.missing ? 'badge rejected' : 'text-muted'}>
                    {r.counts.missing ? `${r.counts.missing} missing` : `${r.counts.present || 0} present`}
                  </span>
                  {isAdmin && r.completed_at && (
                    <button type="button" className="link-button" style={{ width: 'auto', padding: 0, marginLeft: 8 }}
                      aria-label={`Amend ${r.house_name} ${r.session_label} roll call`} onClick={() => setAmending(r.id)}>Amend</button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// --- Leave: decide on requests, sign boarders out and in, give leave directly.
// Boarders whose leave only an admin may give, approve or sign out (e.g. a custody order). House staff see the
// list; admins add and remove. The note is for staff only and never goes to parents or the change log.
function LeaveRules({ isAdmin, boarders }) {
  const [rules, reload, loadError] = useLoader(useCallback(() => api.boarding.restrictions.list(), []))
  const [student, setStudent] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  async function save(body, done) {
    setError('')
    try {
      await api.boarding.restrictions.set(body)
      done?.()
      reload()
    } catch (err) {
      setError(errorText(err))
    }
  }
  const active = (rules || []).filter((r) => r.leave_admin_only)
  if (!isAdmin && active.length === 0) return null
  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Leave only with admin approval</h3>
      <Banner error={error || loadError} />
      {active.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None.</p> : (
        <ul className="support-list">
          {active.map((r) => (
            <li key={r.student} className="support-row">
              <span className="leave-rule"><strong>{r.name}</strong>{r.note ? ` · ${r.note}` : ''} <span className="text-muted">· set by {r.set_by_name}</span></span>
              {isAdmin && (
                <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} aria-label={`Remove the rule for ${r.name}`}
                  onClick={() => save({ student: r.student, leave_admin_only: false, note: '' })}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && (
        <form onSubmit={(e) => { e.preventDefault(); save({ student: Number(student), leave_admin_only: true, note }, () => { setStudent(''); setNote('') }) }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
          <div style={{ flex: '1 1 200px' }}>
            <StudentSelect id="rule-student" label="Boarder needing admin approval" students={boarders || []} value={student}
              onChange={setStudent} emptyLabel="Choose…" required describe={BOARDER_HOUSE} placeholder={BOARDER_SEARCH} />
          </div>
          <label style={{ flex: '1 1 200px' }}>Why (staff only)<input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="e.g. Court order" /></label>
          <button type="submit" className="secondary" style={{ width: 'auto' }}>Add rule</button>
        </form>
      )}
      <p className="hint" style={{ marginBottom: 0 }}>House staff can't give, approve or sign out leave for these boarders. Every parent is emailed about their leave.</p>
    </div>
  )
}

function LeavePanel({ me }) {
  const [leave, reload, loadError] = useLoader(useCallback(() => api.boarding.leave.list(), []))
  const [boarders] = useLoader(useCallback(() => api.boarding.boarders(), []))
  const [form, setForm] = useState(null)
  const [notes, setNotes] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function act(item, verb, message) {
    setError('')
    try {
      await api.boarding.leave.act(item.id, verb, notes[item.id])
      setNotice(message)
      reload()
    } catch (err) {
      setError(errorText(err))
    }
  }
  async function give(e) {
    e.preventDefault()
    setError('')
    try {
      await api.boarding.leave.create({ ...form, student: Number(form.student),
        leaving_at: new Date(form.leaving_at).toISOString(), returning_at: new Date(form.returning_at).toISOString() })
      setForm(null)
      setNotice('Leave recorded. Parents have been told.')
      reload()
    } catch (err) {
      setError(errorText(err))
    }
  }
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  if (!leave) return loadError ? <Banner error={loadError} /> : <p className="text-muted">Loading…</p>
  const groups = [
    ['Waiting for a decision', leave.filter((l) => l.status === 'requested')],
    ['Out now', leave.filter((l) => l.status === 'out')],
    ['Approved, not yet gone', leave.filter((l) => l.status === 'approved')],
    ['Recent', leave.filter((l) => ['returned', 'declined', 'cancelled'].includes(l.status)).slice(0, 15)],
  ]

  return (
    <>
      <Banner error={error} notice={notice} />
      {form ? (
        <div className="card">
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Give leave</h3>
          <form onSubmit={give} className="tt-form-grid">
            <StudentSelect id="leave-student" label="Boarder" students={boarders || []} value={form.student}
              onChange={(v) => setForm((f) => ({ ...f, student: v }))} emptyLabel="Choose…" required
              describe={(b) => `${BOARDER_HOUSE(b)}${b.leave_admin_only ? ' · admin approval only' : ''}`} placeholder={BOARDER_SEARCH} />
            <label>Kind<select value={form.kind} onChange={set('kind')}>{LEAVE_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label>Leaving<input type="datetime-local" value={form.leaving_at} onChange={set('leaving_at')} required /></label>
            <label>Back<input type="datetime-local" value={form.returning_at} onChange={set('returning_at')} required /></label>
            <label>Collected by<input value={form.collected_by} onChange={set('collected_by')} placeholder="e.g. Mother" /></label>
            <label>Reason<input value={form.reason} onChange={set('reason')} /></label>
            <div className="tt-form-actions">
              <button type="submit" style={{ width: 'auto' }}>Give leave</button>
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        </div>
      ) : (
        <button type="button" className="secondary" style={{ width: 'auto', marginBottom: 12 }}
          onClick={() => setForm({ student: '', kind: 'weekend', leaving_at: '', returning_at: '', collected_by: '', reason: '' })}>Give leave</button>
      )}
      <LeaveRules isAdmin={me?.role === 'admin'} boarders={boarders} />
      {groups.map(([title, items]) => (
        <div className="card" key={title}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>{title}</h3>
          {items.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None.</p> : (
            <ul className="support-list">
              {items.map((l) => (
                <li key={l.id}>
                  <div className="support-row">
                    <div>
                      <strong>{l.student_name}</strong> <span className="text-muted">· {l.house} · {l.kind_label}</span>
                      <div>{formatDateTime(l.leaving_at, SHORT)} to {formatDateTime(l.returning_at, SHORT)}</div>
                      <div className="hint" style={{ margin: 0 }}>
                        {[l.collected_by && `Collected by ${l.collected_by}`, l.reason, l.requested_by_name && `Asked by ${l.requested_by_name}`,
                          l.decision_note && `Note: ${l.decision_note}`, l.status !== 'requested' && l.status_label].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    <div className="support-actions">
                      {l.status === 'requested' && <>
                        <button type="button" style={{ width: 'auto' }} onClick={() => act(l, 'approve', `Approved leave for ${l.student_name}. Parents have been told.`)}>Approve</button>
                        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => act(l, 'decline', `Declined leave for ${l.student_name}. Parents have been told.`)}>Decline</button>
                      </>}
                      {l.status === 'approved' && <>
                        <button type="button" style={{ width: 'auto' }} onClick={() => act(l, 'sign-out', `${l.student_name} signed out.`)}>Sign out</button>
                        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => act(l, 'cancel', 'Leave cancelled.')}>Cancel</button>
                      </>}
                      {l.status === 'out' && <button type="button" style={{ width: 'auto' }} onClick={() => act(l, 'sign-in', `${l.student_name} is back.`)}>Sign back in</button>}
                    </div>
                  </div>
                  {l.status === 'requested' && (
                    <input aria-label={`Note for ${l.student_name}'s parents`} placeholder="Note for parents (optional)" style={{ marginTop: 6 }}
                      value={notes[l.id] || ''} onChange={(e) => setNotes({ ...notes, [l.id]: e.target.value })} />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </>
  )
}

// --- Sick bay: check in, record treatment and telling parents, check out.
// The school nurse uses the same sick bay for every student (`everyone`),
// house staff for their own boarders.
export function SickBayPanel({ everyone = false }) {
  const [visits, reload, loadError] = useLoader(useCallback(() => api.boarding.sickBay.list(), []))
  const [boarders] = useLoader(useCallback(() => (everyone
    ? api.students.list({ is_active: true }).then((rows) => (Array.isArray(rows) ? rows : []).map((st) => ({
      id: st.id, name: `${st.first_name} ${st.last_name}`, house: st.external_id || '' })))
    : api.boarding.boarders()), [everyone]))
  const who = everyone ? 'student' : 'boarder'
  const Who = everyone ? 'Student' : 'Boarder'
  const [form, setForm] = useState({ student: '', complaint: '', treatment: '', tell_parents: true })
  const [outcome, setOutcome] = useState({})
  const [how, setHow] = useState({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function run(fn, message) {
    setError('')
    try {
      await fn()
      setNotice(message)
      reload()
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }
  async function checkIn(e) {
    e.preventDefault()
    const name = boarders?.find((b) => String(b.id) === String(form.student))?.name || `The ${who}`
    if (await run(() => api.boarding.sickBay.checkIn({ ...form, student: Number(form.student) }),
      `${name} is checked into sick bay.${form.tell_parents ? ' Parents have been emailed.' : ''}`)) {
      setForm({ student: '', complaint: '', treatment: '', tell_parents: true })
    }
  }
  if (!visits) return loadError ? <Banner error={loadError} /> : <p className="text-muted">Loading…</p>
  const open = visits.filter((v) => !v.checked_out_at)
  const done = visits.filter((v) => v.checked_out_at).slice(0, 20)

  return (
    <>
      <Banner error={error} notice={notice} />
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>Check a {who} in</h3>
        <form onSubmit={checkIn} className="tt-form-grid">
          <StudentSelect id="sick-student" label={Who} students={boarders || []} value={form.student}
            onChange={(v) => setForm((f) => ({ ...f, student: v }))} emptyLabel="Choose…" required
            describe={BOARDER_HOUSE} placeholder={everyone ? 'Type a name or admission number' : BOARDER_SEARCH} />
          <label>Why they came<input value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} placeholder="e.g. headache, fever 38°C" required /></label>
          <label>Given or done<input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="e.g. paracetamol 500 mg" /></label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" style={{ width: 'auto' }} checked={form.tell_parents} onChange={(e) => setForm({ ...form, tell_parents: e.target.checked })} />
            Email parents (the details stay in HouseMaster)
          </label>
          <div className="tt-form-actions"><button type="submit" style={{ width: 'auto' }}>Check in</button></div>
        </form>
      </div>
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>In sick bay now</h3>
        {open.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>Nobody.</p> : (
          <ul className="support-list">
            {open.map((v) => (
              <li key={v.id}>
                <strong>{v.student_name}</strong> <span className="text-muted">· since {formatDateTime(v.checked_in_at, SHORT)}</span>
                <div>{v.complaint}{v.treatment ? ` · ${v.treatment}` : ''}</div>
                <div className="hint" style={{ margin: '2px 0 6px' }}>
                  {v.parents_told_at ? `Parents told: ${v.parents_told_how} (${formatDateTime(v.parents_told_at, SHORT)})` : 'Parents not told yet'}
                </div>
                <div className="support-actions">
                  <select aria-label={`Where ${v.student_name} went`} value={outcome[v.id] || 'back'} onChange={(e) => setOutcome({ ...outcome, [v.id]: e.target.value })} style={{ width: 'auto' }}>
                    {OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <button type="button" style={{ width: 'auto' }} onClick={() => run(() => api.boarding.sickBay.checkOut(v.id, outcome[v.id] || 'back'), `${v.student_name} checked out.`)}>Check out</button>
                </div>
                {!v.parents_told_at && (
                  <div className="support-actions" style={{ marginTop: 6 }}>
                    <input aria-label={`How ${v.student_name}'s parents were told`} placeholder="e.g. phoned mother" value={how[v.id] || ''}
                      onChange={(e) => setHow({ ...how, [v.id]: e.target.value })} style={{ maxWidth: 240 }} />
                    <button type="button" className="secondary" style={{ width: 'auto' }} disabled={!how[v.id]}
                      onClick={() => run(() => api.boarding.sickBay.told(v.id, { how: how[v.id] }), 'Noted.')}>Parents told</button>
                    <button type="button" className="secondary" style={{ width: 'auto' }}
                      onClick={() => run(() => api.boarding.sickBay.told(v.id, { email: true }), 'Parents emailed.')}>Email parents</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Recent visits</h3>
        {done.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None.</p> : (
          <table className="data-table">
            <thead><tr><th>{Who}</th><th>In</th><th>Why</th><th>Given</th><th>Out</th></tr></thead>
            <tbody>
              {done.map((v) => (
                <tr key={v.id}>
                  <td className="row-title">{v.student_name}</td><td data-label="In">{formatDateTime(v.checked_in_at, SHORT)}</td>
                  <td data-label="Why">{v.complaint}</td><td data-label="Given">{v.treatment || '—'}</td>
                  <td data-label="Out">{v.outcome_label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// --- Boarding houses and beds: admins add houses, dorms and beds; boarding staff put students in beds.
function HousesPanel({ me, houses, reload }) {
  const isAdmin = me?.role === 'admin'
  const [staff, setStaff] = useState([])
  const [newHouse, setNewHouse] = useState('')
  const [dormName, setDormName] = useState({})
  const [assigning, setAssigning] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [archived, setArchived] = useState(null)
  const loadArchived = () => api.boarding.houses.list({ archived: 1 }).then(setArchived).catch(() => setArchived([]))

  useEffect(() => { if (isAdmin) api.staff.list().then((s) => setStaff(s.filter((x) => x.is_active !== false))).catch(() => {}) }, [isAdmin])
  useEffect(() => {
    if (!assigning || query.trim().length < 2) { setResults([]); return }
    const t = setTimeout(() => api.boarding.students(query).then(setResults).catch(() => {}), 250)
    return () => clearTimeout(t)
  }, [assigning, query])

  async function run(fn, message) {
    setError('')
    try {
      await fn()
      setNotice(message)
      await reload()
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }
  // The bed may have been taken since the page loaded: the server says so, and the admin chooses whether to replace.
  async function assignBed(bed, student) {
    try {
      return await api.boarding.assignBed(bed, student)
    } catch (err) {
      const text = errorText(err)
      if (!/is in this bed/.test(text) || !window.confirm(`${text}\n\nReplace them?`)) throw err
      return api.boarding.assignBed(bed, student, { replace: true })
    }
  }
  // Put the house's allocated boarders who have no bed in its free beds, at random.
  async function fillBeds(h) {
    const n = Math.min(h.allocated_waiting, h.beds_free)
    if (!window.confirm(`Put ${n} boarder${n === 1 ? '' : 's'} in ${h.name}'s free beds at random? Nobody who already has a bed is moved.`)) return
    setError('')
    try {
      const result = await api.boarding.houses.fillBeds(h.id)
      const who = result.placed.map((p) => `${p.name} (${p.bed})`).join(', ')
      setNotice(`Placed ${result.placed.length} boarder${result.placed.length === 1 ? '' : 's'} in ${h.name}: ${who}.`
        + (result.still_waiting ? ` ${result.still_waiting} still ${result.still_waiting === 1 ? 'needs' : 'need'} a bed: add beds, then fill again.` : ''))
      await reload()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const archive = (h) => {
    if (!window.confirm(`Archive ${h.name}? It disappears from roll calls and lists; its history stays readable.`)) return
    run(() => api.boarding.houses.archive(h.id), `${h.name} is archived. Its history is kept.`).then((ok) => ok && archived && loadArchived())
  }
  const toggleStaff = (house, id) => {
    const next = house.staff.includes(id) ? house.staff.filter((x) => x !== id) : [...house.staff, id]
    run(() => api.boarding.houses.update(house.id, { staff: next }), 'House staff saved.')
  }

  return (
    <>
      <Banner error={error} notice={notice} />
      {isAdmin && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); run(() => api.boarding.houses.create({ name: newHouse }), `${newHouse} added.`).then((ok) => ok && setNewHouse('')) }}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 220px' }}>New boarding house<input value={newHouse} onChange={(e) => setNewHouse(e.target.value)} placeholder="e.g. Uhuru House" required /></label>
          <button type="submit" style={{ width: 'auto' }}>Add house</button>
        </form>
      )}
      {houses.length === 0 && <p className="text-muted">No boarding houses yet.</p>}
      {houses.map((h) => (
        <section className="card" key={h.id} aria-label={h.name}>
          <div className="support-row">
            <h3 style={{ fontSize: 15, margin: '0 0 4px' }}>{h.name}</h3>
            {isAdmin && (
              <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} aria-label={`Archive ${h.name}`}
                onClick={() => archive(h)}>Archive</button>
            )}
          </div>
          <p className="hint" style={{ marginTop: 0 }}>House staff: {h.staff_names.length ? h.staff_names.join(', ') : 'none yet'}</p>
          {(h.allocated_waiting > 0 || h.beds_free > 0) && (
            <div className="fill-beds-row">
              <span>{h.allocated_waiting} allocated boarder{h.allocated_waiting === 1 ? '' : 's'} without a bed · {h.beds_free} free bed{h.beds_free === 1 ? '' : 's'}</span>
              {h.allocated_waiting > 0 && h.beds_free > 0 && (
                <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => fillBeds(h)}>Fill free beds at random</button>
              )}
            </div>
          )}
          {isAdmin && staff.length > 0 && (
            <details style={{ marginBottom: 8 }}>
              <summary>Choose house staff</summary>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 6 }}>
                {staff.map((s) => (
                  <label key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 400 }}>
                    <input type="checkbox" style={{ width: 'auto' }} checked={h.staff.includes(s.id)} onChange={() => toggleStaff(h, s.id)} />{s.name}
                  </label>
                ))}
              </div>
            </details>
          )}
          {h.dorms.map((d) => (
            <div key={d.id} style={{ marginBottom: 10 }}>
              <div className="support-row">
                <strong>{d.name}</strong>
                {isAdmin && (
                  <span className="support-actions">
                    <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => run(() => api.boarding.dorms.addBeds(d.id, 4), 'Added 4 beds.')}>+ 4 beds</button>
                  </span>
                )}
              </div>
              <ul className="bed-grid">
                {d.beds.map((b) => (
                  <li key={b.id} className={b.student ? 'taken' : ''}>
                    <span className="text-muted">{b.name}</span>
                    {assigning === b.id ? (
                      <div>
                        <input autoFocus aria-label={`Who sleeps in ${d.name} ${b.name}`} placeholder="Type a name" value={query} onChange={(e) => setQuery(e.target.value)} />
                        <ul className="bed-results">
                          {results.map((s) => (
                            <li key={s.id}><button type="button" className="link-button" style={{ width: 'auto', padding: 0 }}
                              onClick={() => run(() => assignBed(b.id, s.id), `${s.name} is in ${d.name} ${b.name}.`).then(() => { setAssigning(null); setQuery('') })}>
                              {s.name}{s.class_name ? ` · ${s.class_name}` : ''}{s.bed ? ` (now ${s.bed})` : ''}
                            </button></li>
                          ))}
                        </ul>
                        <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => setAssigning(null)}>Cancel</button>
                      </div>
                    ) : b.student ? (
                      <span><strong>{b.student_name}</strong>{' '}
                        <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }}
                          onClick={() => run(() => api.boarding.assignBed(b.id, null), `${b.student_name} is out of ${b.name}.`)}>Move out</button></span>
                    ) : (
                      <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => { setAssigning(b.id); setQuery('') }}>Put someone here</button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {isAdmin && (
            <form onSubmit={(e) => { e.preventDefault(); run(() => api.boarding.dorms.create({ house: h.id, name: dormName[h.id] }), 'Dormitory added.').then((ok) => ok && setDormName({ ...dormName, [h.id]: '' })) }}
              style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <label style={{ flex: '1 1 200px' }}>New dormitory<input value={dormName[h.id] || ''} onChange={(e) => setDormName({ ...dormName, [h.id]: e.target.value })} placeholder="e.g. Dorm C" required /></label>
              <button type="submit" className="secondary" style={{ width: 'auto' }}>Add dormitory</button>
            </form>
          )}
        </section>
      ))}
      {isAdmin && (
        <details className="card" onToggle={(e) => { if (e.currentTarget.open && archived === null) loadArchived() }}>
          <summary>Archived houses</summary>
          <p className="hint">A house with roll call history can't be deleted. Archived houses keep their history.</p>
          {archived === null ? <p className="text-muted">Loading…</p> : archived.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None.</p> : (
            <ul className="tt-setup-list">
              {archived.map((h) => (
                <li key={h.id}><span>{h.name}</span>
                  <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} aria-label={`Bring back ${h.name}`}
                    onClick={() => run(() => api.boarding.houses.unarchive(h.id), `${h.name} is back.`).then((ok) => ok && loadArchived())}>Bring back</button>
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </>
  )
}

// Which boarding house each boarder belongs to. Admins tick boarders and allocate them; house staff see the list.
function AllocationPanel({ me, houses, reload }) {
  const isAdmin = me?.role === 'admin'
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [query, setQuery] = useState('')
  const [show, setShow] = useState('all')
  const [picked, setPicked] = useState([])
  const [target, setTarget] = useState('')
  const load = useCallback(() => api.boarding.allocations.list().then(setRows).catch((err) => setError(errorText(err))), [])
  useEffect(() => { load() }, [load])
  if (!rows) return error ? <Banner error={error} /> : <p className="text-muted">Loading…</p>

  const q = query.trim().toLowerCase()
  const shown = rows.filter((r) => (show === 'all' || (show === 'none' ? !r.house_id : String(r.house_id) === show))
    && (!q || r.name.toLowerCase().includes(q) || (r.admission_number || '').toLowerCase().includes(q)
      || (r.class_name || '').toLowerCase().includes(q)))
  const allPicked = shown.length > 0 && shown.every((r) => picked.includes(r.id))
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
  const unallocated = rows.filter((r) => !r.house_id).length

  async function allocate(e) {
    e.preventDefault()
    setError('')
    const house = target === 'none' ? null : Number(target)
    try {
      await api.boarding.allocations.allocate(picked, house)
      const name = house ? houses.find((h) => h.id === house)?.name : null
      setNotice(`${picked.length} boarder${picked.length === 1 ? '' : 's'} ${name ? `allocated to ${name}` : 'taken out of their house'}.`
        + (name ? ' Use "Fill free beds at random" on Boarding houses and beds to give them beds.' : ''))
      setPicked([])
      await load()
      reload()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <>
      <Banner error={error} notice={notice} />
      <div className="card">
        <p className="hint" style={{ marginTop: 0 }}>
          {rows.length} boarder{rows.length === 1 ? '' : 's'}{unallocated ? ` · ${unallocated} not in a house yet` : ''}.
          {isAdmin ? ' Tick boarders, choose a house and allocate. Moving a boarder to another house frees their old bed.' : ' Only admins allocate boarders to houses.'}
        </p>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <label className="field" style={{ marginBottom: 0 }}>Search boarders
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, admission number or class" />
          </label>
          <label className="field" style={{ marginBottom: 0 }}>Show
            <select value={show} onChange={(e) => setShow(e.target.value)}>
              <option value="all">All boarders</option>
              <option value="none">Not in a house yet</option>
              {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </label>
        </div>
        {isAdmin && (
          <form className="alloc-bar" onSubmit={allocate}>
            <label className="field" style={{ marginBottom: 0 }}>Allocate to
              <select value={target} onChange={(e) => setTarget(e.target.value)} required>
                <option value="">Choose a house…</option>
                {houses.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                <option value="none">No house (take them out)</option>
              </select>
            </label>
            <button type="submit" style={{ width: 'auto' }} disabled={picked.length === 0}>
              Allocate {picked.length} boarder{picked.length === 1 ? '' : 's'}
            </button>
          </form>
        )}
      </div>
      <div className="card" style={{ padding: 0 }}>
        {shown.length === 0 ? <p className="text-muted" style={{ padding: 16, margin: 0 }}>No boarders match.</p> : (
          <table className="responsive-table">
            <thead>
              <tr>
                {isAdmin && (
                  <th style={{ width: 36 }}>
                    <input type="checkbox" aria-label="Select all shown" style={{ width: 'auto' }} checked={allPicked}
                      onChange={() => setPicked(allPicked ? picked.filter((id) => !shown.some((r) => r.id === id))
                        : [...new Set([...picked, ...shown.map((r) => r.id)])])} />
                  </th>
                )}
                <th>Boarder</th><th>Class</th><th>House</th><th>Bed</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  {isAdmin && (
                    <td><input type="checkbox" aria-label={`Select ${r.name}`} style={{ width: 'auto' }} checked={picked.includes(r.id)} onChange={() => toggle(r.id)} /></td>
                  )}
                  <td>{r.name}{r.admission_number ? <span className="text-muted"> · {r.admission_number}</span> : null}</td>
                  <td>{r.class_name}</td>
                  <td>{r.house || <span className="badge pending">Not in a house</span>}</td>
                  <td>{r.bed || <span className="text-muted">No bed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// Boarding, for house staff and admins.
export default function Boarding({ me }) {
  const [tab, setTab] = useRemembered('panel.boarding.tab', 'today')
  const [houses, setHouses] = useState(null)
  const [error, setError] = useState('')
  const loadHouses = useCallback(() => api.boarding.houses.list().then(setHouses).catch((err) => setError(errorText(err))), [])
  useEffect(() => { loadHouses() }, [loadHouses])

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Boarding</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Beds, roll calls, leave and sick bay{houses?.length ? ` for ${houses.map((h) => h.name).join(', ')}` : ''}.</p>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      <div className="guardian-subtabs" role="tablist" aria-label="Boarding" style={{ marginBottom: 12 }}>
        {SUBTABS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} className={tab === key ? 'active-filter' : 'secondary'} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {!houses ? <p className="text-muted">Loading…</p> : (
        <>
          {tab === 'today' && <Today onGo={setTab} />}
          {tab === 'roll' && (houses.length ? <RollCallPanel houses={houses} me={me} /> : <p className="text-muted">Add a boarding house first.</p>)}
          {tab === 'leave' && <LeavePanel me={me} />}
          {tab === 'sick' && <SickBayPanel />}
          {tab === 'houses' && <HousesPanel me={me} houses={houses} reload={loadHouses} />}
          {tab === 'allocation' && <AllocationPanel me={me} houses={houses} reload={loadHouses} />}
        </>
      )}
    </div>
  )
}

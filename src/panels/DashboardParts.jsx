import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import Panel, { PanelTabs } from './Panel.jsx'

// Pieces shared by the admin and teacher dashboards.

export function Greeting({ me, onStartTour, onNavigate }) {
  const first = me?.name?.split(' ')[0]
  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div className="dash-greeting">
      <div>
        <h2>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}{first ? `, ${first}` : ''}</h2>
        <p className="text-muted">{me?.school?.name} · {today}</p>
      </div>
      <div className="dash-greeting-actions">
        <button type="button" className="link-button" onClick={onStartTour}>Take the tour</button>
        {onNavigate && <button type="button" className="link-button" onClick={() => onNavigate('guide')}>Open the guide</button>}
      </div>
    </div>
  )
}

// Today's lessons, each with a button to take its register.
export function MyDay({ lessons, onNavigate }) {
  return (
    <Panel title="My day" menu={[{ label: 'Open my timetable', onClick: () => onNavigate('timetable') }]}
      actions={<>
        <button type="button" className="secondary" onClick={() => onNavigate('timetable')}>Timetable</button>
        <button type="button" className="secondary" onClick={() => onNavigate('attendance')}>Take a register</button>
      </>}>
      {!lessons || lessons.length === 0 ? (
        <p className="text-muted dash-empty">No lessons on your timetable today.</p>
      ) : (
        <ol className="day-list">
          {lessons.map((l) => (
            <li key={l.id}>
              <span className="tt-time">{l.start_time}–{l.end_time}</span>
              <span className="day-what"><strong>{l.class_name} {l.label}</strong>{l.room_name ? <span className="text-muted"> · {l.room_name}</span> : null}</span>
              <button type="button" className="secondary day-action" aria-label={`Take the register for ${l.class_name} ${l.label}`}
                onClick={() => onNavigate('attendance')}>Register</button>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

// The latest published announcements, plus whatever extra tabs the page adds
// (e.g. registers or boarding), as [key, label, content].
export function Bulletin({ onNavigate, extraTabs = [] }) {
  const [tab, setTab] = useState('news')
  const [items, setItems] = useState(null)
  useEffect(() => {
    api.announcements.page({ status: 'published', page_size: 5 })
      .then((data) => setItems((Array.isArray(data) ? data : data?.results || []).slice(0, 5)))
      .catch(() => setItems([]))
  }, [])
  const tabs = [['news', 'Bulletin'], ...extraTabs.map(([k, label]) => [k, label])]
  const extra = extraTabs.find(([k]) => k === tab)
  return (
    <Panel title="Daily bulletin" menu={[{ label: 'All announcements', onClick: () => onNavigate('announcements') }]}
      actions={<button type="button" className="secondary" onClick={() => onNavigate('announcements')}>Create announcement</button>}>
      {tabs.length > 1 && <PanelTabs tabs={tabs} value={tab} onChange={setTab} label="Daily bulletin" />}
      {tab === 'news' && (
        items === null ? <p className="text-muted dash-empty">Loading…</p>
          : items.length === 0 ? <p className="text-muted dash-empty">No announcements published yet.</p>
            : (
              <ul className="dash-list">
                {items.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    <span className="text-muted">{[a.created_by_name, a.published_at && formatDate(a.published_at)].filter(Boolean).join(' · ')}</span>
                  </li>
                ))}
              </ul>
            )
      )}
      {extra && extra[2]}
    </Panel>
  )
}

// Things waiting on this person, each with a button to deal with it.
// items: [{ key, text, action, onClick, alert }]
export function NeedsAttention({ items, children }) {
  const shown = items.filter(Boolean)
  return (
    <Panel title="Needs attention">
      {shown.length === 0 && !children ? (
        <p className="text-muted dash-empty">Nothing waiting for you. All done.</p>
      ) : (
        <ul className="dash-list">
          {shown.map((i) => (
            <li key={i.key} className={i.alert ? 'alert' : ''}>
              <span>{i.text}</span>
              {i.onClick && <button type="button" className="secondary" onClick={i.onClick}>{i.action || 'Open'}</button>}
            </li>
          ))}
        </ul>
      )}
      {children}
    </Panel>
  )
}

// Students per year group (admins).
export function SchoolNumbers({ rows, onNavigate }) {
  const total = rows.reduce((sum, r) => sum + r.total, 0)
  const female = rows.reduce((sum, r) => sum + r.female, 0)
  const male = rows.reduce((sum, r) => sum + r.male, 0)
  return (
    <Panel title="School numbers" actions={<button type="button" className="secondary" onClick={() => onNavigate('students')}>Students</button>}>
      {rows.length === 0 ? <p className="text-muted dash-empty">No year groups yet.</p> : (
        <table className="dash-table">
          <thead><tr><th>Year group</th><th>Girls</th><th>Boys</th><th>Total</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.female}</td><td>{r.male}</td><td><strong>{r.total}</strong></td></tr>)}
          </tbody>
          <tfoot><tr><td>All</td><td>{female}</td><td>{male}</td><td><strong>{total}</strong></td></tr></tfoot>
        </table>
      )}
    </Panel>
  )
}

// Find a student and open their profile.
export function QuickFind({ onNavigate }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return undefined }
    const timer = setTimeout(() => {
      api.students.page({ q: q.trim(), page_size: 6 })
        .then((data) => setResults((Array.isArray(data) ? data : data?.results || []).slice(0, 6)))
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [q])
  return (
    <Panel title="Find a student">
      <input type="search" aria-label="Student name or admission number" placeholder="Type a name or admission number" value={q}
        onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="dash-list" style={{ marginTop: 8 }}>
          {results.map((s) => (
            <li key={s.id}>
              <span>{s.first_name} {s.last_name}<span className="text-muted">{s.external_id ? ` · ${s.external_id}` : ''}</span></span>
              <button type="button" className="secondary" onClick={() => onNavigate('students', { studentId: s.id })}>Open</button>
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && results.length === 0 && <p className="text-muted dash-empty">No students match.</p>}
    </Panel>
  )
}

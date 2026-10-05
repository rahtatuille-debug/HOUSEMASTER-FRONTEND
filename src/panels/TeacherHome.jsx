import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import { useVocab } from '../levels.js'

// A teacher's home page: their classes with quick actions, and a
// getting-started checklist that ticks itself as they use HouseMaster.
export default function TeacherHome({ me, onNavigate, onStartTour }) {
  const words = useVocab()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  // Reloaded when the tour is finished, so its checklist step ticks off.
  useEffect(() => { api.teacherHome.get().then(setData).catch((err) => setError(err.message)) }, [me?.tour_seen])

  async function setHidden(hidden) {
    try {
      setData(await api.teacherHome.setHidden(hidden))
    } catch (err) {
      setError(err.message)
    }
  }

  if (error && !data) return <div className="error-banner">{error}</div>
  if (!data) return <p className="text-muted">Loading…</p>
  const list = data.checklist
  const firstName = me?.name?.split(' ')[0]
  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })

  function go(tab) {
    if (tab === 'home') onStartTour()
    else onNavigate(tab)
  }

  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}{firstName ? `, ${firstName}` : ''}</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>{me?.school?.name} · {today}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onStartTour}>Take the tour</button>
          <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => onNavigate('guide')}>Open the guide</button>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {!list.hidden && (
        <div className="card checklist-card">
          <div className="checklist-head">
            <div>
              <h3 style={{ fontSize: 15, margin: 0 }}>{list.done === list.total ? "You're all set" : 'Getting started'}</h3>
              <p className="hint" style={{ margin: '4px 0 0' }}>
                {list.done === list.total
                  ? "You've tried everything on the list. You can hide it now."
                  : 'Your first week with HouseMaster. Steps tick themselves as you go.'}
              </p>
            </div>
            <span className="checklist-count" aria-label={`${list.done} of ${list.total} done`}>{list.done} / {list.total}</span>
          </div>
          <div className="checklist-bar" aria-hidden="true"><span style={{ width: `${(list.done / list.total) * 100}%` }} /></div>
          <ol className="checklist">
            {list.steps.map((step) => (
              <li key={step.key} className={step.done ? 'done' : ''}>
                <span className="checklist-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
                <div className="checklist-text"><strong>{step.title}</strong><span className="text-muted">{step.detail}</span></div>
                {!step.done && <button type="button" className="secondary" onClick={() => go(step.tab)}>{step.tab === 'home' ? 'Start' : 'Go'}</button>}
                <span className="visually-hidden">{step.done ? 'Done' : 'Not done yet'}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => setHidden(true)}>Hide this checklist</button>
        </div>
      )}

      {data.today && data.today.length > 0 && (
        <div className="card">
          <div className="support-row">
            <h3 style={{ fontSize: 15, margin: 0 }}>Your lessons today</h3>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => onNavigate('timetable')}>Timetable</button>
          </div>
          <ol className="tt-today-list">
            {data.today.map((l) => (
              <li key={l.id}>
                <span className="tt-time">{l.start_time}–{l.end_time}</span>
                <span><strong>{l.class_name} {l.label}</strong>{l.room_name ? <span className="text-muted"> · {l.room_name}</span> : null}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {data.support && (data.support.suggested > 0 || data.support.open > 0) && (
        <div className="card">
          <div className="support-row">
            <div>
              <h3 style={{ fontSize: 15, margin: 0 }}>Students who need support</h3>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>
                {[
                  data.support.suggested > 0 && `${data.support.suggested} suggested by HouseMaster to look at`,
                  data.support.open > 0 && `${data.support.open} marked as needing support`,
                ].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => onNavigate('support')}>Open</button>
          </div>
          {data.support.due.length > 0 && (
            <>
              <p style={{ margin: '12px 0 4px' }}><strong>Reviews due</strong></p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {data.support.due.map((d) => (
                  <li key={d.id}>{d.student_name} <span className="text-muted">· {formatDate(d.review_date)}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <div className="card">
        <h3 style={{ fontSize: 15, marginBottom: 12 }}>Your {words.classes.toLowerCase()}</h3>
        {data.classes.length === 0 ? (
          <p className="text-muted" style={{ margin: 0 }}>
            You haven&apos;t been given any {words.classes.toLowerCase()} yet. An admin assigns them on the Staff page.
          </p>
        ) : (
          <div className="class-tiles">
            {data.classes.map((c) => (
              <div className="class-tile" key={c.id}>
                <h4>{c.name}</h4>
                <span className="text-muted" style={{ fontSize: 13 }}>
                  {c.year_group}{c.curriculum ? ` · ${c.curriculum}` : ''} · {c.students} student{c.students === 1 ? '' : 's'}
                </span>
                <span style={{ fontSize: 13 }}>
                  {c.class_teacher ? `${words.class} teacher` : ''}{c.class_teacher && c.subjects.length ? ' · ' : ''}{c.subjects.join(', ')}
                </span>
                <span className={c.register_taken_today ? 'badge finalized' : 'badge pending'} style={{ justifySelf: 'start' }}>
                  {c.register_taken_today ? "Today's register is in" : 'Register not taken today'}
                </span>
                <div className="tile-actions">
                  <button type="button" className="secondary" onClick={() => onNavigate('attendance')}>Register</button>
                  <button type="button" className="secondary" onClick={() => onNavigate('grades')}>Marks</button>
                  <button type="button" className="secondary" onClick={() => onNavigate('students')}>Students</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {list.hidden && (
        <p className="hint">
          <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={() => setHidden(false)}>
            Show the getting-started checklist
          </button>
        </p>
      )}
    </div>
  )
}

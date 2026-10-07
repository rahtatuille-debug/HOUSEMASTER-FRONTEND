import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'
import { useVocab } from '../levels.js'
import Panel from './Panel.jsx'
import { Bulletin, Greeting, MyDay, NeedsAttention, QuickFind } from './DashboardParts.jsx'

// A teacher's dashboard: their day, the bulletin, what needs them, their
// classes, and a getting-started checklist that ticks itself as they go.
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

  function go(tab) {
    if (tab === 'home') onStartTour()
    else onNavigate(tab)
  }

  return (
    <div className="dashboard">
      <Greeting me={me} onStartTour={onStartTour} onNavigate={onNavigate} />
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

      <div className="dash-grid">
        <MyDay lessons={data.today} onNavigate={onNavigate} />
        <NeedsAttention items={(() => {
          const missing = (data.classes || []).filter((c) => !c.register_taken_today).map((c) => c.name)
          return [missing.length > 0 && {
            key: 'registers', alert: true, action: 'Register', onClick: () => onNavigate('attendance'),
            text: `${missing.length} register${missing.length === 1 ? '' : 's'} not taken today: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? '…' : ''}`,
          }]
        })()}>
          {data.boarding && (data.boarding.missing.length > 0 || data.boarding.leave_waiting > 0 || data.boarding.sick_bay > 0) && (
            <div className="attention-block">
              <div className="support-row">
                <div>
                  <strong>Boarding</strong>
                  <p className="text-muted" style={{ margin: '2px 0 0' }}>
                    {[
                      data.boarding.leave_waiting > 0 && `${data.boarding.leave_waiting} leave request${data.boarding.leave_waiting === 1 ? '' : 's'} to decide`,
                      data.boarding.sick_bay > 0 && `${data.boarding.sick_bay} in sick bay`,
                    ].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => onNavigate('boarding')}>Boarding</button>
              </div>
              {data.boarding.missing.length > 0 && (
                <p style={{ margin: '8px 0 0', color: 'var(--stamp-red)' }}>
                  <strong>Missing, not found yet:</strong> {data.boarding.missing.map((m) => m.name).join(', ')}
                </p>
              )}
            </div>
          )}
          {data.support && (data.support.suggested > 0 || data.support.open > 0) && (
            <div className="attention-block">
              <div className="support-row">
                <div>
                  <strong>Students who need support</strong>
                  <p className="text-muted" style={{ margin: '2px 0 0' }}>
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
                  <p style={{ margin: '8px 0 2px' }}><strong>Reviews due</strong></p>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {data.support.due.map((d) => (
                      <li key={d.id}>{d.student_name} <span className="text-muted">· {formatDate(d.review_date)}</span></li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </NeedsAttention>
        <Bulletin onNavigate={onNavigate} />
        <QuickFind onNavigate={onNavigate} />
        <Panel title={`My ${words.classes.toLowerCase()}`} wide>
          {data.classes.length === 0 ? (
            <p className="text-muted dash-empty">
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
        </Panel>
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

import { useEffect, useState } from 'react'
import { api } from '../api.js'

// The first things a new school does, with steps of its own for its
// education system. Steps tick themselves as the school does them.
export default function FirstWeekChecklist({ onNavigate }) {
  const [list, setList] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.checklist.get().then(setList).catch((err) => setError(err.message))
  }, [])

  async function setHidden(hidden) {
    setError('')
    try {
      setList(await api.checklist.setHidden(hidden))
    } catch (err) {
      setError(err.message)
    }
  }

  if (!list) return error ? <div className="error-banner">{error}</div> : null
  if (list.hidden) {
    return (
      <p className="hint" style={{ marginBottom: 16 }}>
        <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={() => setHidden(false)}>
          Show the first-week checklist
        </button>
      </p>
    )
  }
  const allDone = list.done === list.total
  // Once everything is done it takes one line, not half the dashboard.
  if (allDone) {
    return (
      <div className="card checklist-done">
        <span className="checklist-mark" aria-hidden="true">✓</span>
        <span><strong>Your first week is done.</strong> <span className="text-muted">All {list.total} steps are complete.</span></span>
        <button type="button" className="link-button" style={{ width: 'auto', padding: 0, marginLeft: 'auto' }} onClick={() => setHidden(true)}>
          Hide this checklist
        </button>
      </div>
    )
  }
  return (
    <div className="card checklist-card">
      <div className="checklist-head">
        <div>
          <h3 style={{ fontSize: 15, margin: 0 }}>{allDone ? 'Your first week is done' : 'Your first week'}</h3>
          <p className="hint" style={{ margin: '4px 0 0' }}>
            {allDone
              ? 'Everything on the list is done. You can hide it now.'
              : `Getting started with HouseMaster${list.system ? ` as a ${list.system} school` : ''}. Steps tick themselves as you go.`}
          </p>
        </div>
        <span className="checklist-count" aria-label={`${list.done} of ${list.total} done`}>{list.done} / {list.total}</span>
      </div>
      <div className="checklist-bar" aria-hidden="true"><span style={{ width: `${(list.done / list.total) * 100}%` }} /></div>
      {error && <div className="error-banner">{error}</div>}
      <ol className="checklist">
        {list.steps.map((step) => (
          <li key={step.key} className={step.done ? 'done' : ''}>
            <span className="checklist-mark" aria-hidden="true">{step.done ? '✓' : ''}</span>
            <div className="checklist-text">
              <strong>{step.title}</strong>
              <span className="text-muted">{step.detail}</span>
            </div>
            {!step.done && (
              <button type="button" className="secondary" onClick={() => onNavigate(step.tab)}>Go</button>
            )}
            <span className="visually-hidden">{step.done ? 'Done' : 'Not done yet'}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => setHidden(true)}>
        Hide this checklist
      </button>
    </div>
  )
}

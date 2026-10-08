import { useState } from 'react'
import { formatDate } from '../format.js'
import { dueText } from './Homework.jsx'

const BADGE = { handed_in: 'finalized', late: 'pending', missing: 'rejected', excused: 'draft' }

// A student's homework, for their parents (and the student). With `onHandIn`
// the student can mark it done and type an answer or paste a link.
export default function HomeworkList({ items, firstName, onHandIn }) {
  const [show, setShow] = useState('todo')
  const [open, setOpen] = useState(null)
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  if (!items) return <p className="text-muted">Loading…</p>
  const done = (h) => Boolean(h.status || h.done_at)
  const todo = items.filter((h) => !done(h))
  const shown = show === 'todo' ? todo : items.filter(done).reverse()
  async function handIn(h, undo = false) {
    setBusy(true)
    try { await onHandIn(h, undo ? { done: false } : { done: true, answer }); setOpen(null) } finally { setBusy(false) }
  }
  return (
    <div>
      <div className="scope-tabs filter-row" role="tablist" aria-label="Homework">
        {[['todo', `To do (${todo.length})`], ['done', 'Done and marked']].map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={show === k} className={`secondary${show === k ? ' active' : ''}`} onClick={() => setShow(k)}>{l}</button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-muted">{show === 'todo' ? `Nothing to do right now${firstName ? ` for ${firstName}` : ''}.` : 'Nothing here yet.'}</p>
      ) : (
        <ul className="hw-list">
          {shown.map((h) => (
            <li key={h.id} className="card hw-card">
              <div className="hw-card-head">
                <span className="club-kind">{h.subject}</span>
                {h.status ? <span className={`badge ${BADGE[h.status] || 'draft'}`}>{h.status_label}{h.mark != null ? ` · ${Number(h.mark)}${h.out_of ? `/${h.out_of}` : ''}` : ''}</span>
                  : h.done_at ? <span className="badge finalized">Marked done</span>
                    : <span className={`badge ${h.overdue ? 'rejected' : 'pending'}`}>{h.overdue ? 'Overdue' : dueText(h.due_date)}</span>}
              </div>
              <strong className="hw-title">{h.title}</strong>
              {h.instructions && <p className="hw-instructions">{h.instructions}</p>}
              {h.link && <a href={h.link} target="_blank" rel="noopener noreferrer" className="hw-link">{h.link}</a>}
              <span className="hint" style={{ margin: 0 }}>Set {formatDate(h.set_on, { day: 'numeric', month: 'short' })}{h.set_by_name ? ` by ${h.set_by_name}` : ''} · due {formatDate(h.due_date, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              {h.answer && <div className="discipline-notes"><span className="text-muted">Handed in:</span> {h.answer}</div>}
              {h.comment && <div className="discipline-notes"><span className="text-muted">Teacher:</span> {h.comment}</div>}
              {onHandIn && !h.status && (open === h.id ? (
                <div className="hw-handin">
                  <label>Your answer or a link (optional)
                    <textarea rows={3} value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={4000} placeholder="Type your answer, or paste a link to your work" />
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={{ width: 'auto' }} disabled={busy} onClick={() => handIn(h)}>Hand in</button>
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="support-actions" style={{ marginTop: 6 }}>
                  {h.done_at
                    ? <button type="button" className="link-button" style={{ width: 'auto' }} disabled={busy} onClick={() => handIn(h, true)}>Not done after all</button>
                    : <button type="button" style={{ width: 'auto' }} onClick={() => { setOpen(h.id); setAnswer(h.answer || '') }}>Mark as done</button>}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

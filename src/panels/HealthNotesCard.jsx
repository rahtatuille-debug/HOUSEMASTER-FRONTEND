import { useState } from 'react'
import { formatDate } from '../format.js'
import { api } from '../api.js'

// A parent's view of their child's health notes, with a way to suggest a
// change. The school keeps the record: a suggestion waits in the school's
// Approvals until an admin accepts it (guardians/health_notes.py).
export default function HealthNotesCard({ studentId, notes, request, onRequestChange }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = request?.status === 'pending'

  function start() {
    setText(notes || '')
    setReason('')
    setError('')
    setEditing(true)
  }

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const sent = await api.guardianStudents.suggestHealthNotes(studentId, { medical_notes: text, reason: reason.trim() })
      setEditing(false)
      onRequestChange(sent)
    } catch (err) {
      setError(err.status === 404 && !err.data?.detail?.includes('suggestion')
        ? 'Suggesting changes isn’t available yet. Please tell the school directly.'
        : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function withdraw() {
    setBusy(true)
    setError('')
    try {
      onRequestChange(await api.guardianStudents.withdrawHealthNotes(studentId))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, marginBottom: 8 }}>Health notes on file</h3>
      {notes ? <div className="health-box">{notes}</div> : <p className="text-muted" style={{ marginTop: 0 }}>None recorded.</p>}

      {pending && (
        <div className="health-request">
          <p style={{ margin: '10px 0 6px' }}><strong>Waiting for the school</strong> to check your suggestion
            {request.created_at ? ` (sent ${formatDate(request.created_at)})` : ''}:</p>
          {request.medical_notes
            ? <div className="health-box">{request.medical_notes}</div>
            : <p className="text-muted" style={{ margin: 0 }}>Clear the health notes.</p>}
          <button type="button" className="secondary" style={{ width: 'auto', marginTop: 8 }} disabled={busy} onClick={withdraw}>
            Withdraw
          </button>
        </div>
      )}
      {request?.status === 'rejected' && !editing && (
        <p className="hint">
          The school didn’t make your last change{request.review_note ? `: “${request.review_note}”` : '.'}
        </p>
      )}
      {request?.status === 'approved' && !editing && <p className="hint">The school accepted your last change.</p>}

      {error && <div className="error-banner" style={{ marginTop: 10 }}>{error}</div>}

      {editing ? (
        <form onSubmit={send} style={{ marginTop: 10 }}>
          <div className="field">
            <label htmlFor={`hn-${studentId}`}>Health notes</label>
            <textarea id={`hn-${studentId}`} rows={4} maxLength={2000} value={text}
              placeholder="Allergies, conditions or medication the school should know about"
              onChange={(e) => setText(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={`hn-reason-${studentId}`}>Anything the school should know? (optional)</label>
            <input id={`hn-reason-${studentId}`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="hint">The school checks your suggestion before it goes on your child’s record.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="submit" style={{ width: 'auto' }} disabled={busy}>{busy ? 'Sending…' : 'Send to the school'}</button>
            <button type="button" className="secondary" style={{ width: 'auto' }} disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      ) : !pending && (
        <button type="button" className="secondary" style={{ width: 'auto', marginTop: 10 }} onClick={start}>
          Suggest a change
        </button>
      )}
    </div>
  )
}

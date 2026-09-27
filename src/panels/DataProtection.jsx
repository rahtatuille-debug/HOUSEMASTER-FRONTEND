import { useState } from 'react'
import { api } from '../api.js'

// Admin tools for a family's data protection requests (Kenya Data Protection
// Act): download everything held, or remove the family's personal details.
export default function DataProtection({ student, onRemoved }) {
  const name = `${student.first_name} ${student.last_name}`
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const matches = typed.trim().split(/\s+/).join(' ').toLowerCase() === name.trim().split(/\s+/).join(' ').toLowerCase()

  async function download() {
    setError('')
    try {
      await api.students.dataExport(student.id)
    } catch (err) {
      setError(err.message)
    }
  }

  async function remove(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.students.removePersonalData(student.id, typed)
      onRemoved()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Data protection requests</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Under the Kenya Data Protection Act, a family can ask for a copy of the data the school holds about them, or
        ask for it to be deleted.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <h4 style={{ margin: '14px 0 4px' }}>Copy of their data</h4>
      <p className="text-muted" style={{ margin: '0 0 8px', fontSize: 14 }}>
        An Excel file with {name}'s details, parents and their contact details, grades, attendance, reports and the
        parents' messages.
      </p>
      <button type="button" className="secondary" onClick={download}>Download all personal data</button>

      <h4 style={{ margin: '22px 0 4px' }}>Remove personal details</h4>
      <p className="text-muted" style={{ margin: '0 0 8px', fontSize: 14 }}>
        Deletes {name}'s name, admission number, date of birth, health notes, photo and reports, and the accounts
        and messages of parents who have no other children here (parents with other children just lose the link).
        Grades and attendance are kept under "Removed student" so class averages stay correct. This can't be undone.
      </p>
      {confirming ? (
        <form onSubmit={remove}>
          <div className="field">
            <label htmlFor="confirm-removal">Type <strong>{name}</strong> to confirm</label>
            <input id="confirm-removal" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
          <div className="form-actions">
            <button type="submit" className="danger" disabled={!matches || busy}>
              {busy ? 'Removing…' : 'Remove personal details'}
            </button>
            <button type="button" className="secondary" onClick={() => { setConfirming(false); setTyped('') }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="danger" onClick={() => setConfirming(true)}>Remove personal details…</button>
      )}
    </div>
  )
}

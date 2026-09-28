import { useRef, useState } from 'react'
import { useVocab } from '../levels.js'
import { api } from '../api.js'

const ROLE = { teacher: 'Teacher', admin: 'Admin' }

function inviteLink(token) {
  return `${window.location.origin}/invite/${token}`
}

// A CSV of name, email and invite link, so the admin can share links however they like.
function downloadLinks(people) {
  const quote = (v) => `"${String(v).replace(/"/g, '""')}"`
  const rows = [['Name', 'Email', 'Role', 'Invite link'], ...people.map((p) => [p.name, p.email, ROLE[p.role], inviteLink(p.token)])]
  const blob = new Blob([rows.map((r) => r.map(quote).join(',')).join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'staff-invite-links.csv'
  link.click()
  URL.revokeObjectURL(url)
}

// Admins: invite many staff at once from a spreadsheet, with their classes.
export default function StaffImportCard({ onImported }) {
  const words = useVocab()
  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [done, setDone] = useState(null)
  const [sendEmails, setSendEmails] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(commit) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const result = await api.importStaff(file, commit, commit && sendEmails)
      if (commit) {
        setDone({ ...result, emailed: sendEmails })
        setPreview(null)
        setFile(null)
        onImported?.()
      } else {
        setPreview(result)
        setDone(null)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  function chooseFile(e) {
    setFile(e.target.files?.[0] || null)
    setPreview(null)
    setDone(null)
    setError('')
    e.target.value = ''
  }

  const result = preview || done
  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Import staff from Excel</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        One row per person: name, email, role (teacher or admin), the classes they're class teacher of, and what they
        teach, e.g. <em>7 West: Mathematics; 8 East: Mathematics, English</em>. Each person gets an invite, and their
        classes are assigned when they accept. Add classes and subjects in Setup first.
      </p>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-actions" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="secondary" onClick={() => api.downloadStaffTemplate().catch((e) => setError(e.message))}>
          Download template
        </button>
        <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={chooseFile} />
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
          {file ? 'Choose a different file' : 'Choose spreadsheet'}
        </button>
        {file && <span className="text-muted" style={{ fontSize: 13 }}>{file.name}</span>}
        {file && !preview && (
          <button type="button" onClick={() => run(false)} disabled={busy}>
            {busy ? 'Checking…' : 'Preview import'}
          </button>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 14 }}>
          <div className={done ? 'success-banner' : 'info-notice'}>
            {done
              ? `Invited ${done.people.length} staff.${done.emailed && done.people.length ? ' Their invite links are being emailed.' : ''}`
              : `${preview.people.length} ${preview.people.length === 1 ? 'person' : 'people'} will be invited. Nothing is saved until you import.`}
            {result.skipped.length > 0 && ` ${result.skipped.length} skipped (already at the school).`}
            {result.errors.length > 0 && (result.errors.length === 1
              ? ` 1 row has a problem and ${done ? "wasn't" : "won't be"} imported (see below).`
              : ` ${result.errors.length} rows have problems and ${done ? "weren't" : "won't be"} imported (see below).`)}
          </div>

          {result.people.length > 0 && (
            <div className="table-scroll">
              <table className="responsive-table">
                <thead><tr><th>Row</th><th>Name</th><th>Email</th><th>Role</th><th>{words.classes}</th></tr></thead>
                <tbody>
                  {result.people.map((p) => (
                    <tr key={p.email}>
                      <td className="text-muted">{p.row}</td>
                      <td>{p.name}</td>
                      <td>{p.email}</td>
                      <td>{ROLE[p.role]}</td>
                      <td>{p.assignments.length ? p.assignments.join(', ') : <span className="text-muted">None</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.skipped.length > 0 && (
            <p className="hint">Skipped because they already have an account or a pending invite: {result.skipped.map((s) => `${s.name} (row ${s.row})`).join(', ')}.</p>
          )}
          {result.errors.length > 0 && (
            <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
              <table className="responsive-table">
                <thead><tr><th>Row</th><th>Problem</th></tr></thead>
                <tbody>{result.errors.map((e, i) => <tr key={i}><td>{e.row}</td><td>{e.message}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          {preview && preview.people.length > 0 && (
            <>
              <label className="checkbox-label" style={{ margin: '12px 0' }}>
                <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} />
                Email each person their invite link
              </label>
              <div className="form-actions">
                <button type="button" onClick={() => run(true)} disabled={busy}>
                  {busy ? 'Importing…' : `Invite ${preview.people.length} staff`}
                </button>
                <button type="button" className="secondary" onClick={() => { setPreview(null); setFile(null) }}>Cancel</button>
              </div>
            </>
          )}
          {done && done.people.length > 0 && (
            <div className="form-actions" style={{ marginTop: 12 }}>
              <button type="button" className="secondary" onClick={() => downloadLinks(done.people)}>
                Download invite links (CSV)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

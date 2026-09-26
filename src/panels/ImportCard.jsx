import { useRef, useState } from 'react'
import { api } from '../api.js'

const COUNT_LABELS = [
  ['students_created', 'new students'],
  ['students_updated', 'students updated'],
  ['grades', 'grades'],
  ['attendance', 'attendance records'],
]

// Admins: upload a workbook, preview exactly what will happen, then import.
export default function ImportCard({ onImported }) {
  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(commit) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const result = await api.importWorkbook(file, commit)
      if (commit) {
        setDone(result)
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
  }

  const result = preview || done
  const toImport = result
    ? Object.values(result.counts).reduce((a, b) => a + b, 0)
    : 0
  const created = result ? Object.entries(result.created).filter(([, names]) => names.length) : []

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Import from Excel</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Add or update students, grades and attendance from one workbook. You'll see a preview before anything is
        saved. Re-importing updates students by admission number instead of adding duplicates.
      </p>
      {error && <div className="error-banner">{error}</div>}
      <div className="form-actions" style={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" className="secondary" onClick={() => api.downloadImportTemplate().catch((e) => setError(e.message))}>
          Download template
        </button>
        <input ref={fileInput} type="file" accept=".xlsx" hidden onChange={chooseFile} />
        <button type="button" className="secondary" onClick={() => fileInput.current?.click()}>
          {file ? 'Choose a different file' : 'Choose workbook'}
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
          {done ? (
            <div className="success-banner">Import finished.</div>
          ) : (
            <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Preview: nothing has been saved yet.</p>
          )}
          <p style={{ margin: '0 0 8px' }}>
            {COUNT_LABELS.map(([key, label]) => `${result.counts[key]} ${label}`).join(' · ')}
          </p>
          {created.map(([kind, names]) => (
            <p key={kind} className="text-muted" style={{ margin: '0 0 4px', fontSize: 13 }}>
              New {kind.replace('_', ' ')}: {names.join(', ')}
            </p>
          ))}
          {result.errors.length > 0 && (
            <>
              <p style={{ margin: '12px 0 6px', color: 'var(--stamp-red)', fontWeight: 600 }}>
                {result.errors.length}{result.errors_truncated ? '+' : ''} row{result.errors.length === 1 ? '' : 's'} with
                problems {done ? 'were' : 'will be'} skipped:
              </p>
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                <table>
                  <thead><tr><th>Sheet</th><th>Row</th><th>Problem</th></tr></thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i}><td>{e.sheet}</td><td>{e.row}</td><td>{e.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {preview && (
            <div className="form-actions" style={{ marginTop: 12 }}>
              <button type="button" onClick={() => run(true)} disabled={busy || toImport === 0}>
                {busy ? 'Importing…' : `Import ${toImport} row${toImport === 1 ? '' : 's'}`}
              </button>
              <button type="button" className="secondary" onClick={() => setPreview(null)}>Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

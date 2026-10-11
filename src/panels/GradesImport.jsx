import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'
import { classesFor, perms } from '../permissions.js'

// Marks for a whole class from Excel: download the class's mark sheet, type the marks in, then check and import
// it. The server applies the same rules as typing marks one at a time (gradebook/marksheet.py).
const STATUS = { ok: 'Ready', skipped: 'Skipped', error: 'Problem' }

export default function GradesImport({ me, subjects, terms, types, onImported }) {
  const words = useVocab()
  const [classes, setClasses] = useState([])
  const [form, setForm] = useState({ school_class: '', subject: '', term: '', assessment_type: '', max_score: '100' })
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [open, setOpen] = useState(false)
  const [allRows, setAllRows] = useState(false)

  useEffect(() => {
    if (open) api.schoolClasses.list().then((all) => setClasses(classesFor(me, all, 'academic'))).catch(() => {})
  }, [me, open])

  // The subjects this person may mark in the chosen class (the server checks again).
  const p = perms(me)
  const mySubjects = subjects.filter((s) => {
    if (me?.role === 'admin' || p.is_leader) return true
    if ((me?.roles || []).some((r) => r.role === 'head_of_department' && r.subject === s.id)) return true
    return (me?.assignments || []).some((a) => String(a.school_class) === String(form.school_class) && (a.subject === null || a.subject === s.id))
  })
  const openTerms = terms.filter((t) => !t.is_locked)
  const ready = form.school_class && form.subject && form.term

  function set(key) {
    return (e) => { setForm({ ...form, [key]: e.target.value }); setPreview(null); setDone('') }
  }

  async function download() {
    setError('')
    try {
      await api.marksheets.template(form)
    } catch (err) {
      setError(err.message)
    }
  }

  async function send(commit) {
    setBusy(true)
    setError('')
    setDone('')
    try {
      const result = await api.marksheets.importFile(file, form, commit)
      if (commit) {
        setDone(`Imported ${result.imported} mark${result.imported === 1 ? '' : 's'}.`)
        setPreview(null)
        setFile(null)
        onImported?.()
      } else {
        setPreview(result)
        setAllRows(false)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <div className="card support-row">
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Import marks from Excel</h3>
          <p className="hint" style={{ margin: '2px 0 0' }}>A whole {words.class.toLowerCase()}&apos;s marks at once, from a mark sheet.</p>
        </div>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setOpen(true)}>Import marks</button>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="support-row">
        <h3 style={{ marginBottom: 6, fontSize: 15 }}>Import marks from Excel</h3>
        <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => setOpen(false)}>Close</button>
      </div>
      <p className="hint" style={{ marginTop: 0 }}>
        Download the mark sheet for a {words.class.toLowerCase()}: it lists every student who takes the {words.subject.toLowerCase()}.
        Type each mark in Excel, then upload it. You&apos;ll see what will be saved before anything is. Leave a mark blank, or
        write ABS, for a student who has none.
      </p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {done && <div className="success-banner" role="status">{done}</div>}
      <div className="form-row">
        <div className="field">
          <label htmlFor="mi-class">{words.class}</label>
          <select id="mi-class" value={form.school_class} onChange={(e) => { setForm({ ...form, school_class: e.target.value, subject: '' }); setPreview(null) }}>
            <option value="">Choose…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mi-subject">{words.subject}</label>
          <select id="mi-subject" value={form.subject} onChange={set('subject')} disabled={!form.school_class}>
            <option value="">Choose…</option>
            {mySubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="mi-term">{words.term}</label>
          <select id="mi-term" value={form.term} onChange={set('term')}>
            <option value="">Choose…</option>
            {openTerms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        {types.length > 0 && (
          <div className="field">
            <label htmlFor="mi-type">Assessment type</label>
            <select id="mi-type" value={form.assessment_type} onChange={set('assessment_type')}>
              <option value="">None</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="mi-out-of">Out of</label>
          <input id="mi-out-of" type="number" min="1" max="999" step="any" value={form.max_score} onChange={set('max_score')} />
        </div>
      </div>
      <div className="signup-actions" style={{ marginBottom: 12 }}>
        <button type="button" className="secondary" disabled={!ready} onClick={download}>Download mark sheet</button>
      </div>
      <div className="field">
        <label htmlFor="mi-file">Filled-in mark sheet</label>
        <input id="mi-file" type="file" accept=".xlsx" disabled={!ready} onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setDone('') }} />
      </div>
      <button type="button" style={{ width: 'auto' }} disabled={!ready || !file || busy} onClick={() => send(false)}>
        {busy && !preview ? 'Checking…' : 'Check the file'}
      </button>

      {preview && (
        <div style={{ marginTop: 16 }}>
          <p style={{ margin: '0 0 8px' }}>
            <strong>{preview.counts.ready}</strong> mark{preview.counts.ready === 1 ? '' : 's'} ready to import
            {preview.counts.skipped > 0 && <> · {preview.counts.skipped} skipped</>}
            {preview.counts.errors > 0 && <> · <span className="text-danger">{preview.counts.errors} with a problem (not imported)</span></>}
          </p>
          {preview.missing.length > 0 && (
            <p className="hint" style={{ marginTop: 0 }}>Not in the sheet: {preview.missing.join(', ')}.</p>
          )}
          {/* The rows that need a look first; the ready ones on request (a class can be 60 rows). */}
          {(() => {
            const flagged = preview.rows.filter((r) => r.status !== 'ok')
            const shown = allRows ? preview.rows : flagged
            return (
              <>
          {shown.length > 0 && (
          <div className="table-scroll">
            <table className="responsive-table">
              <thead><tr><th>Row</th><th>Admission no.</th><th>Student</th><th>Mark</th><th>Status</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td><td>{r.admission_number}</td><td>{r.name || '—'}</td><td>{r.mark || '—'}</td>
                    <td className={r.status === 'error' ? 'text-danger' : r.status === 'skipped' ? 'text-muted' : ''}>
                      {STATUS[r.status]}{r.message && r.status !== 'ok' ? `: ${r.message}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          {preview.rows.length > flagged.length && (
            <button type="button" className="link-button" style={{ width: 'auto', padding: 0, marginTop: 8 }} onClick={() => setAllRows(!allRows)}>
              {allRows ? 'Show only the rows to look at' : `Show all ${preview.rows.length} rows`}
            </button>
          )}
              </>
            )
          })()}
          <div className="signup-actions" style={{ marginTop: 12 }}>
            <button type="button" style={{ width: 'auto' }} disabled={busy || !preview.counts.ready} onClick={() => send(true)}>
              {busy ? 'Importing…' : `Import ${preview.counts.ready} mark${preview.counts.ready === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => setPreview(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

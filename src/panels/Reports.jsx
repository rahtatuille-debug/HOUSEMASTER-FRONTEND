import { useEffect, useState } from 'react'
import { useVocab } from '../levels.js'
import { formatDate } from '../format.js'
import { api } from '../api.js'
import ClassReports from './ClassReports.jsx'

const STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Waiting for approval',
  finalized: 'Finalized',
}

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'submitted', label: 'Waiting for approval' },
  { key: 'finalized', label: 'Finalized' },
]

// Reports go draft -> submitted for approval (teacher) -> finalized (admin
// only). Parents only ever see finalized reports. An admin can send a
// report back to draft with a note.
export default function Reports({ me, onCountsChanged }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [filter, setFilter] = useState('')
  const [notice, setNotice] = useState('')
  const [sendingBack, setSendingBack] = useState(false)
  const [backNote, setBackNote] = useState('')
  const [students, setStudents] = useState([])
  const [terms, setTerms] = useState([])
  const [reports, setReports] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  const [genStudent, setGenStudent] = useState('')
  const [genTerm, setGenTerm] = useState('')

  const [openReport, setOpenReport] = useState(null) // full report object being reviewed
  const [editSummary, setEditSummary] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadOptions() {
    try {
      const [s, t] = await Promise.all([api.students.list(), api.terms.list()])
      setStudents(s)
      setTerms(t)
    } catch (err) {
      setError(err.message)
    }
  }

  async function loadReports() {
    setLoading(true)
    setError('')
    try {
      const data = await api.reports.list(filter ? { status: filter } : {})
      setReports(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  async function handleGenerate(e) {
    e.preventDefault()
    if (!genStudent || !genTerm) return
    setGenerating(true)
    setError('')
    try {
      const report = await api.reports.generate(Number(genStudent), Number(genTerm))
      await loadReports()
      openForReview(report)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  function openForReview(report) {
    setOpenReport(report)
    setEditSummary(report.progress_summary)
    setEditComment(report.report_comment)
    setSendingBack(false)
    setBackNote('')
    setNotice('')
  }

  const hasUnsavedEdits =
    openReport && (editSummary !== openReport.progress_summary || editComment !== openReport.report_comment)

  // Saves any edits first, then runs the approval step (if any).
  async function act(step, message) {
    if (!openReport) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      let report = openReport
      if (hasUnsavedEdits && report.status !== 'finalized') {
        report = await api.reports.update(report.id, {
          progress_summary: editSummary,
          report_comment: editComment,
        })
      }
      if (step) report = await step(report)
      openForReview(report)
      setNotice(message)
      loadReports()
      onCountsChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const studentName = (id) => {
    const s = students.find((s) => s.id === id)
    return s ? `${s.first_name} ${s.last_name}` : `#${id}`
  }
  const termName = (id) => terms.find((t) => t.id === id)?.name || `#${id}`

  return (
    <div>
      <div className="panel-header">
        <h2>Reports</h2>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}

      <ClassReports me={me} terms={terms} onChanged={() => { loadReports(); onCountsChanged?.() }} />

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>One student</h3>
        <form onSubmit={handleGenerate} className="form-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="r-student">Student</label>
            <select id="r-student" value={genStudent} onChange={(e) => setGenStudent(e.target.value)} required>
              <option value="">Select…</option>
              {students.filter((s) => s.is_active).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="r-term">{words.term}</label>
            <select id="r-term" value={genTerm} onChange={(e) => setGenTerm(e.target.value)} required>
              <option value="">Select…</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" disabled={generating}>
            {generating ? 'Generating…' : 'Generate with AI'}
          </button>
        </form>
        <p className="hint">
          Regenerating a report for the same student and term overwrites the existing draft. Reports
          that are waiting for approval or finalized can't be regenerated
          {isAdmin ? ' until you send them back.' : ' unless an admin sends them back.'}
        </p>
      </div>

      {openReport && (
        <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>
              {studentName(openReport.student)} — {termName(openReport.term)}
            </h3>
            <span className={`badge ${openReport.status}`}>{STATUS_LABELS[openReport.status] || openReport.status}</span>
          </div>

          {openReport.status === 'draft' && openReport.review_note && (
            <div className="note-box">
              <strong>Sent back by an admin</strong>
              {openReport.review_note}
            </div>
          )}
          {openReport.status === 'submitted' && !isAdmin && (
            <p className="hint" style={{ marginTop: 0 }}>
              Submitted for approval. An admin will finalize it or send it back with a note.
            </p>
          )}
          {openReport.status === 'finalized' && (
            <p className="hint" style={{ marginTop: 0 }}>
              Finalized{openReport.finalized_by_name ? ` by ${openReport.finalized_by_name}` : ''} — parents can see
              this report. It can't be edited
              {isAdmin ? ' unless you send it back.' : ' unless an admin sends it back.'}
            </p>
          )}

          <div className="field">
            <label htmlFor="edit-summary">Progress summary</label>
            <textarea
              id="edit-summary"
              rows={4}
              value={editSummary}
              readOnly={openReport.status === 'finalized'}
              onChange={(e) => setEditSummary(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-comment">Report comment</label>
            <textarea
              id="edit-comment"
              rows={4}
              value={editComment}
              readOnly={openReport.status === 'finalized'}
              onChange={(e) => setEditComment(e.target.value)}
            />
          </div>

          {sendingBack ? (
            <div className="field">
              <label htmlFor="send-back-note">What needs changing?</label>
              <textarea id="send-back-note" rows={2} value={backNote} onChange={(e) => setBackNote(e.target.value)} />
              <div className="form-actions" style={{ marginTop: 8 }}>
                <button
                  className="danger"
                  disabled={saving || !backNote.trim()}
                  onClick={() =>
                    act((r) => api.reports.sendBack(r.id, backNote.trim()), 'Sent back to draft with your note.')
                  }
                >
                  {openReport.status === 'finalized' ? 'Take back from parents and send back' : 'Send back'}
                </button>
                <button className="secondary" onClick={() => setSendingBack(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="form-actions">
              {openReport.status === 'draft' && (
                <button onClick={() => act((r) => api.reports.submit(r.id), 'Submitted for approval.')} disabled={saving}>
                  Submit for approval
                </button>
              )}
              {isAdmin && openReport.status !== 'finalized' && (
                <button
                  onClick={() => act((r) => api.reports.finalize(r.id), 'Finalized. Parents can now see this report.')}
                  disabled={saving}
                >
                  Finalize and release to parents
                </button>
              )}
              {isAdmin && openReport.status !== 'draft' && (
                <button className="secondary" onClick={() => setSendingBack(true)} disabled={saving}>
                  Send back with a note
                </button>
              )}
              {openReport.status !== 'finalized' && (
                <button className="secondary" onClick={() => act(null, 'Edits saved.')} disabled={saving || !hasUnsavedEdits}>
                  Save edits
                </button>
              )}
              <button className="secondary" onClick={() => setOpenReport(null)}>
                Close
              </button>
            </div>
          )}
        </div>
      )}

      <h3 style={{ margin: '24px 0 12px', fontSize: 15 }}>Reports</h3>
      <div className="filter-row">
        {FILTERS.map((f) => (
          <button
            key={f.key || 'all'}
            type="button"
            className={`secondary${filter === f.key ? ' active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <h3>No reports here</h3>
          <p>{filter ? 'Try a different filter.' : 'Generate one above to get started.'}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>{words.term}</th>
              <th>Status</th>
              <th>Generated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>{studentName(r.student)}</td>
                <td>{termName(r.term)}</td>
                <td>
                  <span className={`badge ${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span>
                </td>
                <td className="text-muted">{formatDate(r.generated_at)}</td>
                <td>
                  <button className="secondary" onClick={() => openForReview(r)}>
                    Review
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

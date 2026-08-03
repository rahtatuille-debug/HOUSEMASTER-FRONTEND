import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Reports() {
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
      const [s, t] = await Promise.all([api.students.list({ is_active: true }), api.terms.list()])
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
      const data = await api.reports.list()
      setReports(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOptions()
    loadReports()
  }, [])

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
  }

  async function saveStatus(status) {
    if (!openReport) return
    setSaving(true)
    setError('')
    try {
      const updated = await api.reports.update(openReport.id, {
        progress_summary: editSummary,
        report_comment: editComment,
        status,
      })
      setOpenReport(updated)
      loadReports()
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

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>Generate a report</h3>
        <form onSubmit={handleGenerate} className="form-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="r-student">Student</label>
            <select id="r-student" value={genStudent} onChange={(e) => setGenStudent(e.target.value)} required>
              <option value="">Select…</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="r-term">Term</label>
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
          Regenerating a report for the same student and term overwrites the existing draft.
        </p>
      </div>

      {openReport && (
        <div className="card" style={{ borderLeft: '3px solid var(--gold)' }}>
          <div className="panel-header" style={{ marginBottom: 12 }}>
            <h3 style={{ fontSize: 16 }}>
              {studentName(openReport.student)} — {termName(openReport.term)}
            </h3>
            <span className={`badge ${openReport.status}`}>{openReport.status}</span>
          </div>

          <div className="field">
            <label htmlFor="edit-summary">Progress summary</label>
            <textarea
              id="edit-summary"
              rows={4}
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-comment">Report comment</label>
            <textarea
              id="edit-comment"
              rows={4}
              value={editComment}
              onChange={(e) => setEditComment(e.target.value)}
            />
          </div>

          <div className="form-actions">
            {openReport.status === 'draft' && (
              <button onClick={() => saveStatus('reviewed')} disabled={saving}>
                Mark as reviewed
              </button>
            )}
            {openReport.status === 'reviewed' && (
              <button onClick={() => saveStatus('finalized')} disabled={saving}>
                Finalize
              </button>
            )}
            {openReport.status !== 'draft' && (
              <button className="secondary" onClick={() => saveStatus('draft')} disabled={saving}>
                Revert to draft
              </button>
            )}
            <button className="secondary" onClick={() => saveStatus(openReport.status)} disabled={saving}>
              Save edits
            </button>
            <button className="secondary" onClick={() => setOpenReport(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      <h3 style={{ margin: '24px 0 12px', fontSize: 15 }}>All reports</h3>
      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : reports.length === 0 ? (
        <div className="empty-state">
          <h3>No reports yet</h3>
          <p>Generate one above to get started.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Term</th>
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
                  <span className={`badge ${r.status}`}>{r.status}</span>
                </td>
                <td className="text-muted">{new Date(r.generated_at).toLocaleDateString()}</td>
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

import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

// Reports for a whole class at once: generate the missing AI drafts (one
// student at a time, so progress shows and it can be stopped), submit every
// draft, and (admins) finalize everything submitted.
export default function ClassReports({ me, terms, onChanged }) {
  const isAdmin = me?.role === 'admin'
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [termId, setTermId] = useState('')
  const [progress, setProgress] = useState(null) // { done, total, current, failed: [] }
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const stopRef = useRef(false)

  useEffect(() => {
    api.schoolClasses.list()
      .then((cls) => {
        const assigned = new Set((me?.assignments || []).map((a) => a.school_class))
        setClasses(isAdmin ? cls : cls.filter((c) => assigned.has(c.id)))
      })
      .catch((err) => setError(err.message))
  }, [isAdmin, me])

  const className = classes.find((c) => String(c.id) === classId)?.name
  const termName = terms.find((t) => String(t.id) === termId)?.name
  const ready = classId && termId && !busy

  function start() {
    setBusy(true)
    setError('')
    setNotice('')
  }

  async function generate() {
    start()
    stopRef.current = false
    try {
      const run = await api.reports.generateClass(Number(classId), Number(termId))
      const already = run.already_have_reports
      if (run.students.length === 0) {
        setNotice(`Every student in ${className} already has a ${termName} report.`)
        return
      }
      const skippedNote = already ? ` ${already} student${already === 1 ? '' : 's'} already had one and ${already === 1 ? 'was' : 'were'} left unchanged.` : ''
      const failed = []
      let made = 0
      for (let i = 0; i < run.students.length; i++) {
        if (stopRef.current) break
        const s = run.students[i]
        setProgress({ done: i, total: run.students.length, current: s.name, failed: [...failed] })
        try {
          const result = await api.reports.generateClassNext(run.run, s.id)
          if (!result.skipped) made++
        } catch (err) {
          failed.push({ name: s.name, reason: err.message })
          // Without a working AI connection every other student would fail too.
          if (err.status === 503) break
        }
      }
      setProgress(null)
      const stopped = stopRef.current ? ' Stopped before the end; start again to finish the rest.' : ''
      setNotice(`Generated ${made} draft report${made === 1 ? '' : 's'} for ${className}, ${termName}.${skippedNote}${stopped}`)
      if (failed.length) {
        setError(`${failed.length} couldn't be generated: ${failed.map((f) => `${f.name} (${f.reason})`).join('; ')}`)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setProgress(null)
      setBusy(false)
      onChanged?.()
    }
  }

  async function bulk(call, describe) {
    start()
    try {
      const { count } = await call(Number(classId), Number(termId))
      setNotice(describe(count))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
      onChanged?.()
    }
  }

  function submitAll() {
    bulk(api.reports.submitClass, (n) => n
      ? `Submitted ${n} draft${n === 1 ? '' : 's'} for ${className} for approval.`
      : `No ${className} drafts for ${termName} to submit.`)
  }

  function finalizeAll() {
    if (!window.confirm(`Finalize every submitted ${className} report for ${termName}? Parents will be able to see them straight away. Drafts are left for teachers to finish.`)) return
    bulk(api.reports.finalizeClass, (n) => n
      ? `Finalized ${n} report${n === 1 ? '' : 's'} for ${className}. Parents can now see them.`
      : `No submitted ${className} reports for ${termName} are waiting to be finalized.`)
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 14, fontSize: 15 }}>Whole class</h3>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <div className="form-row">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="cr-class">Class</label>
          <select id="cr-class" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={busy}>
            <option value="">Select…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="cr-term">Term</label>
          <select id="cr-term" value={termId} onChange={(e) => setTermId(e.target.value)} disabled={busy}>
            <option value="">Select…</option>
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {progress ? (
        <div className="bulk-progress" role="status">
          <div className="bulk-progress-label">
            Generating {progress.done + 1} of {progress.total}: {progress.current}
          </div>
          <progress value={progress.done} max={progress.total} />
          <button type="button" className="secondary" onClick={() => { stopRef.current = true }}>
            Stop after this one
          </button>
        </div>
      ) : (
        <div className="form-actions" style={{ marginTop: 12 }}>
          <button type="button" onClick={generate} disabled={!ready}>Generate missing reports</button>
          <button type="button" className="secondary" onClick={submitAll} disabled={!ready}>Submit all drafts</button>
          {isAdmin && (
            <button type="button" className="secondary" onClick={finalizeAll} disabled={!ready}>
              Finalize all submitted
            </button>
          )}
        </div>
      )}
      <p className="hint">
        Generating only creates reports for students who don't have one for that term yet, so nothing already
        written is replaced. Each new report is a draft for you to read and edit before submitting.
      </p>
    </div>
  )
}

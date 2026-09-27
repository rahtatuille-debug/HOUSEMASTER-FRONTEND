import { useEffect, useState } from 'react'
import { api } from '../api.js'

// A sample report card for a made-up student, in the style chosen so far in
// the setup wizard. It's the real PDF, built from the answers and not saved.
export default function ReportPreview({ body, title = 'See a sample report card' }) {
  const [url, setUrl] = useState('')
  const [shownFor, setShownFor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = JSON.stringify(body)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function show() {
    setBusy(true)
    setError('')
    try {
      setUrl(await api.setup.previewReport(body))
      setShownFor(key)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const stale = url && shownFor !== key
  return (
    <div className="report-preview">
      <div className="report-preview-bar">
        <div>
          <strong>{title}</strong>
          <p className="hint" style={{ margin: '2px 0 0' }}>
            What parents will receive, for a made-up student, with the choices you&apos;ve made so far.
          </p>
        </div>
        <button type="button" className="secondary" onClick={show} disabled={busy || (url && !stale)}>
          {busy ? 'Preparing…' : !url ? 'Show sample' : stale ? 'Update sample' : 'Up to date'}
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {url && (
        <>
          <iframe className="report-preview-frame" title="Sample report card" src={url} />
          <a href={url} target="_blank" rel="noreferrer" className="hint">Open the sample in a new tab</a>
        </>
      )}
    </div>
  )
}

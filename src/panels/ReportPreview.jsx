import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { renderPdfPages } from '../pdfPages.js'

// A sample report card for a made-up student, in the style chosen so far in
// the setup wizard. It's the real PDF, built from the answers and not saved,
// shown as page images so it works on phones too.
export default function ReportPreview({ body, title = 'See a sample report card' }) {
  const [url, setUrl] = useState('')
  const [pages, setPages] = useState([])
  const [shownFor, setShownFor] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = JSON.stringify(body)

  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])

  async function show() {
    setBusy(true)
    setError('')
    try {
      const blob = await api.setup.previewReport(body)
      setPages(await renderPdfPages(blob, 800))
      setUrl(URL.createObjectURL(blob))
      setShownFor(key)
    } catch (err) {
      setError(err.message || 'The sample could not be shown.')
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
      {pages.length > 0 && (
        <>
          <div className="report-preview-pages">
            {pages.map((src, i) => (
              <img key={i} src={src} alt={`Sample report card, page ${i + 1} of ${pages.length}`} />
            ))}
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="hint" download="sample-report-card.pdf">
            Download the sample PDF
          </a>
        </>
      )}
    </div>
  )
}

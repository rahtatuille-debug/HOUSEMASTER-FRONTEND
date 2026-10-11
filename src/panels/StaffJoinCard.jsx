import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'

export function staffJoinLink(token) {
  return `${window.location.origin}/staff-join/${token}`
}

// One link for every new member of staff: share it, then approve who signs up. Approving emails each person
// the usual invite, so they choose their password from their own inbox.
export default function StaffJoinCard({ schoolName, onChanged }) {
  const [link, setLink] = useState(null) // {token, waiting}
  const [requests, setRequests] = useState([])
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null) // {done, problems}

  async function load() {
    try {
      const [state, waiting] = await Promise.all([api.staffJoin.link(), api.staffJoin.requests()])
      setLink(state)
      setRequests(waiting)
    } catch (err) {
      setError(err.message)
    }
  }
  useEffect(() => { load() }, [])

  async function change(action) {
    if (action === 'renew' && !window.confirm('Make a new link? The old one will stop working.')) return
    setBusy(true)
    setError('')
    try {
      setLink(await api.staffJoin.change(action))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function decide(ids, decision) {
    setBusy(true)
    setError('')
    try {
      const answer = await api.staffJoin.decide(ids, decision)
      setRequests(answer.requests)
      setResult({ done: answer.done, problems: answer.problems })
      setLink((l) => (l ? { ...l, waiting: answer.requests.length } : l))
      if (decision === 'approve') onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function copy() {
    const url = staffJoinLink(link.token)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link:', url)
    }
  }

  const whatsapp = link?.token && `https://wa.me/?text=${encodeURIComponent(
    `Staff of ${schoolName || 'our school'}: please create your HouseMaster account here: ${staffJoinLink(link.token)}`)}`

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6, fontSize: 15 }}>Staff sign-up link</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        One link for all your teachers. Share it, for example in the staff WhatsApp group. Each person enters their
        name and email, and waits here for you to approve them. Approving emails them a link to choose their
        password. They join as teachers; you can change their role and classes below.
      </p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {result?.done?.length > 0 && <div className="success-banner" role="status">{result.done.join(' ')}</div>}
      {result?.problems?.length > 0 && <div className="error-banner" role="alert">{result.problems.join(' ')}</div>}
      {!link ? <p className="text-muted">Loading…</p> : link.token ? (
        <>
          <code className="signup-link" style={{ display: 'block', marginBottom: 10 }}>{staffJoinLink(link.token)}</code>
          <span className="signup-actions">
            <button type="button" onClick={copy} style={{ width: 'auto' }}>{copied ? 'Copied!' : 'Copy link'}</button>
            <a className="button secondary" href={whatsapp} target="_blank" rel="noreferrer">WhatsApp</a>
            <button type="button" className="secondary" disabled={busy} onClick={() => change('renew')}>New link</button>
            <button type="button" className="secondary" disabled={busy} onClick={() => change('off')}>Turn off</button>
          </span>
        </>
      ) : (
        <button type="button" style={{ width: 'auto' }} disabled={busy} onClick={() => change('create')}>Make a staff sign-up link</button>
      )}

      {requests.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div className="support-row">
            <strong style={{ fontSize: 14 }}>Waiting for you ({requests.length})</strong>
            {requests.length > 1 && (
              <button type="button" style={{ width: 'auto' }} disabled={busy}
                onClick={() => decide(requests.filter((r) => !r.has_account).map((r) => r.id), 'approve')}>
                Approve all
              </button>
            )}
          </div>
          <ul className="support-list">
            {requests.map((r) => (
              <li key={r.id}>
                <div className="support-row">
                  <div>
                    <strong>{r.name}</strong> <span className="text-muted">· {r.email}</span>
                    <div className="hint" style={{ margin: 0 }}>
                      {[r.phone, `asked ${formatDate(r.created_at, { day: 'numeric', month: 'short' })}`].filter(Boolean).join(' · ')}
                    </div>
                    {r.note && <div style={{ fontSize: 13, marginTop: 2 }}>&ldquo;{r.note}&rdquo;</div>}
                    {r.has_account && <div className="hint" style={{ margin: 0, color: 'var(--stamp-red)' }}>This email already has an account.</div>}
                  </div>
                  <span className="signup-actions">
                    <button type="button" disabled={busy || r.has_account} aria-label={`Approve ${r.name}`} onClick={() => decide([r.id], 'approve')}>Approve</button>
                    <button type="button" className="secondary" disabled={busy} aria-label={`Turn down ${r.name}`} onClick={() => decide([r.id], 'reject')}>Turn down</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

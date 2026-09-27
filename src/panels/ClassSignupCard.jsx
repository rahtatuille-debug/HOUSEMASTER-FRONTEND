import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'
import { formatDate } from '../format.js'

const RELATIONSHIP = { mother: 'Mother', father: 'Father', guardian: 'Guardian', grandparent: 'Grandparent',
  sibling: 'Sibling', other: 'Other relative' }

function joinLink(token) {
  return `${window.location.origin}/join/${token}`
}

// Parents asking to join through a class sign-up link. Approving emails each
// one their own invite link (or adds the child to the account they have).
export function SignupRequests({ onChanged }) {
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState([])

  const load = () => api.signupRequests.list().then(setRows).catch((err) => setError(err.message))
  useEffect(() => { load() }, [])

  async function decide(ids, decision) {
    if (decision === 'reject' && !window.confirm(ids.length > 1 ? `Turn down ${ids.length} requests?` : 'Turn down this request?')) return
    setBusy(true)
    setError('')
    try {
      const result = await api.signupRequests.decide(ids, decision)
      setRows(result.requests)
      setNotice([...result.done, ...result.problems.map((p) => `Not done: ${p}`)])
      onChanged?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (!rows) return error ? <div className="error-banner">{error}</div> : null
  if (!rows.length && !notice.length) return null
  // Matched to a student in the class the link was for, and not a second parent of the same type.
  const clear = rows.filter((r) => r.student?.in_this_class)
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h3 style={{ margin: 0, fontSize: 15 }}>Sign-up requests {rows.length > 0 && <span className="badge pending">{rows.length} waiting</span>}</h3>
        {clear.length > 1 && (
          <button type="button" disabled={busy} style={{ width: 'auto' }} onClick={() => decide(clear.map((r) => r.id), 'approve')}>
            Approve all {clear.length} that match their class
          </button>
        )}
      </div>
      <p className="hint">
        Check each parent against the child they named. Approving emails them a link to set their password; turning
        a request down tells them nothing.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice.length > 0 && (
        <div className="success-banner">{notice.map((n) => <div key={n}>{n}</div>)}</div>
      )}
      {rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr><th>Parent</th><th>Child</th><th>Already linked</th><th>Asked</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.name}</strong>{r.relationship && <span className="text-muted"> · {RELATIONSHIP[r.relationship]}</span>}
                    <div className="text-muted" style={{ fontSize: 13 }}>{r.email}{r.phone && ` · ${r.phone}`}</div>
                    {r.has_account && <div className="hint" style={{ margin: 0 }}>Has an account: the child will be added to it.</div>}
                  </td>
                  <td>
                    {r.student ? (
                      <>
                        {r.student.name} <span className="text-muted">({r.student.admission_number})</span>
                        {!r.student.in_this_class && (
                          <div className="error-text" style={{ fontSize: 13 }}>
                            In {r.student.class_name}, not {r.class_name} (the link they used)
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="error-text">No student with admission no. {r.admission_number}</span>
                    )}
                  </td>
                  <td className="text-muted">{r.existing_parents.join(', ') || '—'}</td>
                  <td className="text-muted">{formatDate(r.created_at)}</td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {r.student && (
                      <button type="button" disabled={busy} style={{ width: 'auto', marginRight: 6 }} onClick={() => decide([r.id], 'approve')}>
                        Approve
                      </button>
                    )}
                    <button type="button" className="secondary" disabled={busy} style={{ width: 'auto' }} onClick={() => decide([r.id], 'reject')}>
                      Turn down
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// One sign-up link per class, to share with that class's parents.
export function ClassSignupLinks({ refreshKey }) {
  const words = useVocab()
  const [rows, setRows] = useState(null)
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api.signupLinks.list().then(setRows).catch((err) => setError(err.message))
  }, [refreshKey])

  async function change(row, action) {
    if (action === 'renew' && !window.confirm(`Replace the link for ${row.class_name}? The old link will stop working.`)) return
    if (action === 'off' && !window.confirm(`Turn off the link for ${row.class_name}? Nobody will be able to use it.`)) return
    setBusy(row.school_class)
    setError('')
    try {
      setRows(await api.signupLinks.change(row.school_class, action))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  async function copy(row) {
    try {
      await navigator.clipboard.writeText(joinLink(row.token))
      setCopied(row.school_class)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      window.prompt('Copy this link:', joinLink(row.token))
    }
  }

  function whatsapp(row) {
    const text = `Parents of ${row.class_name}: please join our school on HouseMaster to get reports and messages. `
      + `Sign up here with your child's admission number: ${joinLink(row.token)}`
    return `https://wa.me/?text=${encodeURIComponent(text)}`
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6, fontSize: 15 }}>{words.class} sign-up links</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        The quickest way to bring in a whole {words.class.toLowerCase()} of parents. Turn on a link and share it,
        for example in the {words.class.toLowerCase()}&apos;s WhatsApp group. Parents enter their details and their
        child&apos;s admission number, and their requests wait above for you to approve.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {rows && rows.length === 0 && <p className="text-muted">Add {words.classes.toLowerCase()} in Setup first.</p>}
      {rows && rows.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead><tr><th>{words.class}</th><th>Link</th><th /></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.school_class}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {row.class_name} <span className="text-muted">· {row.year_group}</span>
                    {row.waiting > 0 && <div className="hint" style={{ margin: 0 }}>{row.waiting} waiting</div>}
                  </td>
                  <td>
                    {row.token
                      ? <code className="signup-link">{joinLink(row.token)}</code>
                      : <span className="text-muted">Off</span>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {row.token ? (
                      <span className="signup-actions">
                        <button type="button" className="secondary" onClick={() => copy(row)}>{copied === row.school_class ? 'Copied!' : 'Copy'}</button>
                        <a className="button secondary" href={whatsapp(row)} target="_blank" rel="noreferrer">WhatsApp</a>
                        <button type="button" className="secondary" disabled={busy === row.school_class} onClick={() => change(row, 'renew')}>New link</button>
                        <button type="button" className="secondary" disabled={busy === row.school_class} onClick={() => change(row, 'off')}>Turn off</button>
                      </span>
                    ) : (
                      <button type="button" disabled={busy === row.school_class} style={{ width: 'auto' }} onClick={() => change(row, 'create')}>Turn on</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

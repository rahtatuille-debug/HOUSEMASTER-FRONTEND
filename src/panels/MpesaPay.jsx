import { useEffect, useRef, useState } from 'react'

const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
const POLL_MS = 4000
const GIVE_UP_MS = 4 * 60 * 1000

// "Pay with M-Pesa": the payer's phone and the amount, then a PIN prompt on the phone. We ask the server how
// it went every few seconds until it's paid or not. `start(body)` sends the prompt and resolves to the request;
// `check(id)` resolves to its status. With `fixedAmount` the amount isn't asked.
export default function MpesaPay({ start, check, defaultAmount = '', fixedAmount = null, onPaid, onClose }) {
  const [form, setForm] = useState({ phone: '', amount: fixedAmount ?? defaultAmount })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(null) // the request while we wait
  const [result, setResult] = useState(null)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  function poll(req, since) {
    timer.current = setTimeout(async () => {
      try {
        const now = await check(req.id)
        if (now.status === 'pending' && Date.now() - since < GIVE_UP_MS) return poll(req, since)
        setPending(null)
        setResult(now)
        if (now.status === 'paid' && onPaid) onPaid(now)
      } catch {
        if (Date.now() - since < GIVE_UP_MS) poll(req, since)
      }
    }, POLL_MS)
  }

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const req = await start(fixedAmount != null ? { phone: form.phone } : { phone: form.phone, amount: form.amount })
      setPending(req)
      poll(req, Date.now())
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    return (
      <div className="card mpesa-card" role="status">
        <h3 style={{ marginTop: 0 }}>Check your phone</h3>
        <p>Enter your M-Pesa PIN on the prompt sent to {pending.phone} to pay KES {Number(pending.amount).toLocaleString()}.</p>
        <p className="hint" style={{ marginBottom: 0 }}>This page updates by itself when the payment goes through.</p>
      </div>
    )
  }
  if (result?.status === 'paid') {
    return (
      <div className="card mpesa-card">
        <div className="success-banner" role="status" style={{ marginTop: 0 }}>
          Paid: KES {Number(result.amount).toLocaleString()}{result.receipt && ` (M-Pesa ${result.receipt})`}. Thank you.
        </div>
        {onClose && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onClose}>Done</button>}
      </div>
    )
  }
  return (
    <form className="card mpesa-card tt-form-grid" onSubmit={send} aria-label="Pay with M-Pesa">
      {result?.status === 'failed' && <div className="error-banner" role="alert">Not paid: {result.message || 'the prompt was cancelled or timed out'}. You can try again.</div>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      <label>M-Pesa phone number
        <input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
          placeholder="e.g. 0712 345 678" required />
      </label>
      {fixedAmount == null ? (
        <label>Amount (KES)
          <input type="number" min="1" step="1" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
        </label>
      ) : <p style={{ margin: 0 }}>Amount: <strong>KES {Number(fixedAmount).toLocaleString()}</strong></p>}
      <div className="tt-form-actions">
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Sending…' : 'Send the prompt to my phone'}</button>
        {onClose && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onClose}>Cancel</button>}
      </div>
    </form>
  )
}

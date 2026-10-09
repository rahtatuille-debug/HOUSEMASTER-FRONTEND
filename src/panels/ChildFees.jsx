import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate } from '../format.js'

export const PAY_METHODS = [['mpesa', 'M-Pesa'], ['bank', 'Bank transfer'], ['cash', 'Cash'], ['cheque', 'Cheque'], ['card', 'Card'], ['other', 'Other']]

export const amount = (value, currency) => `${currency || ''} ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim()
export const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function balanceText(balance, currency) {
  const b = Number(balance)
  if (b > 0) return `${amount(b, currency)} to pay`
  if (b < 0) return `${amount(-b, currency)} in credit`
  return 'Fully paid'
}

// A parent's view of their child's fees: balance, how to pay, "we've paid", charges and receipts.
export default function ChildFees({ studentId, firstName }) {
  const [data, setData] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.guardianStudents.fees(studentId).then(setData).catch((err) => setError(err.message))
  useEffect(() => { load() }, [studentId]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function send(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      setData(await api.guardianStudents.feeClaim(studentId, form))
      setForm(null)
      setNotice("Thank you. The school will check the payment and send you a receipt.")
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }

  async function receipt(p) {
    setError('')
    try {
      await api.guardianStudents.feeReceipt(studentId, p.id)
    } catch (err) {
      setError(err.message)
    }
  }

  if (!data) return error ? <div className="error-banner" role="alert">{error}</div> : <p className="text-muted">Loading…</p>
  const cur = data.currency
  const open = data.claims.filter((c) => c.status !== 'confirmed')
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <div className="card">
        <div className="stat-row fees-stats">
          <div className="stat-tile"><div className="stat-label">Balance</div><div className={`stat-value${Number(data.balance) > 0 ? ' fees-owing' : ''}`}>{balanceText(data.balance, cur)}</div></div>
          <div className="stat-tile"><div className="stat-label">Charged</div><div className="stat-value">{amount(data.charged, cur)}</div></div>
          <div className="stat-tile"><div className="stat-label">Paid</div><div className="stat-value">{amount(data.paid, cur)}</div></div>
        </div>
        {data.payment_instructions && (
          <>
            <h3 style={{ fontSize: 15, margin: '12px 0 4px' }}>How to pay</h3>
            <p className="fees-instructions" style={{ margin: 0 }}>{data.payment_instructions}</p>
          </>
        )}
        {!form && (
          <button type="button" style={{ width: 'auto', marginTop: 12 }}
            onClick={() => { setNotice(''); setForm({ amount: '', paid_on: localToday(), method: 'mpesa', reference: '', note: '' }) }}>
            We&apos;ve paid
          </button>
        )}
        {form && (
          <form onSubmit={send} className="tt-form-grid" style={{ marginTop: 12 }} aria-label="We've paid">
            <label>Amount ({cur})<input type="number" min="1" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required /></label>
            <label>Paid on<input type="date" max={localToday()} value={form.paid_on} onChange={set('paid_on')} required /></label>
            <label>How<select value={form.method} onChange={set('method')}>{PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Reference<input value={form.reference} onChange={set('reference')} required maxLength={100} placeholder="e.g. the M-Pesa code" /></label>
            <label>Note (optional)<input value={form.note} onChange={set('note')} maxLength={300} /></label>
            <div className="tt-form-actions">
              <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Sending…' : 'Send to the school'}</button>
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm(null)}>Cancel</button>
            </div>
          </form>
        )}
        {open.length > 0 && (
          <ul className="support-list" style={{ marginTop: 12 }}>
            {open.map((c) => (
              <li key={c.id}>
                <strong>{amount(c.amount, cur)}</strong> on {formatDate(c.paid_on)} ({c.method_label}, {c.reference})
                <div className="hint" style={{ margin: 0 }}>{c.status === 'open' ? 'The school is checking this payment.' : `The school couldn't find this payment: ${c.reject_reason}`}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card table-scroll">
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Charges</h3>
        {data.charges.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No fees charged for {firstName} yet.</p> : (
          <table>
            <thead><tr><th>What</th><th>Amount</th></tr></thead>
            <tbody>{data.charges.map((c) => (
              <tr key={c.id}><td>{c.description}{c.term && <div className="text-muted">{c.term}</div>}</td><td>{amount(c.amount, cur)}</td></tr>
            ))}</tbody>
          </table>
        )}
      </div>

      <div className="card table-scroll">
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Payments</h3>
        {data.payments.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No payments recorded yet.</p> : (
          <table>
            <thead><tr><th>Paid</th><th>Amount</th><th>Receipt</th></tr></thead>
            <tbody>{data.payments.map((p) => (
              <tr key={p.id}>
                <td>{formatDate(p.paid_on)}<div className="text-muted">{p.method_label}{p.reference && ` · ${p.reference}`}</div></td><td>{amount(p.amount, cur)}</td>
                <td><button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => receipt(p)} aria-label={`Download receipt ${p.receipt_number}`}>{p.receipt_number}</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </>
  )
}

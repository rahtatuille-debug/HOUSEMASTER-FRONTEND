import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate, formatDateTime } from '../format.js'

export const PAY_METHODS = [['mpesa', 'M-Pesa'], ['bank', 'Bank transfer'], ['cash', 'Cash'], ['card', 'Card'], ['other', 'Other']]
const STATE_BADGE = { exempt: 'finalized', active: 'finalized', due: 'pending', overdue: 'draft', locked: 'inactive' }
const INVOICE_BADGE = { open: 'pending', paid: 'finalized' }

export const money = (amount, currency) => (amount === null || amount === undefined ? 'Price not set'
  : `${currency || ''} ${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`.trim())
const size = (t, prev) => (t.max_students ? `${prev ? prev + 1 : 1}–${t.max_students} students` : `${prev ? prev + 1 : 1}+ students`)
const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message

// What the status means for the school, in a sentence.
export function billingSentence(b) {
  if (!b) return ''
  if (b.status === 'exempt') return 'Your school uses HouseMaster free of charge.'
  if (b.status === 'active') return 'Your subscription is paid up.'
  if (b.status === 'due') return b.days_left > 0 ? `An invoice is due in ${b.days_left} day${b.days_left === 1 ? '' : 's'}.` : 'An invoice is due today.'
  if (b.status === 'overdue') return `An invoice is overdue. HouseMaster will pause for everyone at your school on ${formatDate(b.locked_from)} unless it's paid.`
  if (b.status === 'locked') return 'HouseMaster is paused for your school until the overdue invoice is paid. Only admins can sign in, and only to this page.'
  return ''
}

function ReportPaid({ invoice, onDone, onCancel }) {
  const [form, setForm] = useState({ method: 'mpesa', reference: '', note: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      onDone(await api.billing.reportPaid(invoice.id, form))
    } catch (err) {
      setError(fieldError(err))
      setBusy(false)
    }
  }
  return (
    <form className="card" onSubmit={submit} aria-label={`We've paid ${invoice.number}`}>
      <h3 style={{ marginTop: 0 }}>We&apos;ve paid {invoice.number}</h3>
      <p className="hint">Tell us how you paid. We check the payment and mark the invoice paid, usually within a working day.</p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <label>How you paid
        <select value={form.method} onChange={set('method')}>
          {PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>Reference
        <input value={form.reference} onChange={set('reference')} required maxLength={100} placeholder="e.g. the M-Pesa code" />
      </label>
      <label>Note (optional)
        <input value={form.note} onChange={set('note')} maxLength={300} />
      </label>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Sending…' : 'Send'}</button>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}

export default function Billing() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paying, setPaying] = useState(null)

  const load = useCallback(() => {
    api.billing.get().then(setData).catch((err) => setError(err.message))
  }, [])
  useEffect(() => { load() }, [load])

  async function pdf(invoice) {
    setError('')
    try {
      await api.billing.invoicePdf(invoice.id)
    } catch (err) {
      setError(err.message)
    }
  }

  if (data === null) {
    return (
      <div className="panel">
        <h2>Billing</h2>
        {error ? <div className="error-banner" role="alert">{error}</div> : <p className="text-muted">Loading…</p>}
      </div>
    )
  }

  const open = data.invoices.filter((i) => i.status === 'open')
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Billing</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Your school&apos;s monthly HouseMaster subscription. The price depends on how many students you have.</p>
        </div>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}

      <div className="card billing-status">
        <p style={{ margin: 0 }}><span className={`badge ${STATE_BADGE[data.status] || 'pending'}`}>{data.label}</span></p>
        <p style={{ margin: '8px 0 0' }}>{billingSentence(data)}</p>
        <dl className="billing-facts">
          <div><dt>Students</dt><dd>{data.students}</dd></div>
          {!data.exempt && <div><dt>Your tier</dt><dd>{data.plan ? `${data.plan.name}: ${money(data.plan.monthly_price, data.plan.currency)} a month` : 'None'}</dd></div>}
          {data.paid_until && <div><dt>Paid up to</dt><dd>{formatDate(data.paid_until)}</dd></div>}
          {!data.exempt && <div><dt>Grace period</dt><dd>{data.grace_days} days after the due date</dd></div>}
        </dl>
      </div>

      {!data.exempt && data.tiers.length > 0 && (
        <div className="card table-scroll">
          <h3 style={{ marginTop: 0 }}>Prices</h3>
          <table className="dash-table">
            <thead><tr><th>Tier</th><th>School size</th><th>Monthly</th></tr></thead>
            <tbody>
              {data.tiers.map((t, n) => (
                <tr key={t.name} className={data.plan?.name === t.name ? 'billing-current' : ''}>
                  <td>{t.name}{data.plan?.name === t.name && <span className="text-muted"> (you)</span>}</td>
                  <td>{size(t, data.tiers[n - 1]?.max_students)}</td>
                  <td>{money(t.monthly_price, t.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data.exempt && open.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>How to pay</h3>
          <p className="billing-instructions">{data.payment_instructions || 'Payment details will be sent to you by email.'}</p>
          <p className="hint" style={{ marginBottom: 0 }}>Use the invoice number as the reference, then press &quot;We&apos;ve paid&quot; below.</p>
        </div>
      )}

      {paying && (
        <ReportPaid invoice={paying} onCancel={() => setPaying(null)}
          onDone={() => { setPaying(null); setNotice("Thank you. We'll check the payment and mark the invoice paid."); load() }} />
      )}

      <div className="card table-scroll">
        <h3 style={{ marginTop: 0 }}>Invoices</h3>
        {data.invoices.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>No invoices yet.</p> : (
          <table className="dash-table billing-invoices">
            <thead><tr><th>Invoice</th><th>Month</th><th>Amount</th><th>Due</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.invoices.map((i) => (
                <tr key={i.id}>
                  <td>{i.number}<div className="text-muted">{i.plan_name} · {i.students} students</div></td>
                  <td>{formatDate(i.period_start, { day: 'numeric', month: 'short' })} to {formatDate(i.period_end, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td>{money(i.amount, i.currency)}</td>
                  <td>{formatDate(i.due_on)}</td>
                  <td>
                    <span className={`badge ${INVOICE_BADGE[i.status] || 'pending'}`}>{i.status === 'paid' && i.paid_on ? `Paid ${formatDate(i.paid_on, { day: 'numeric', month: 'short' })}` : i.status_label}</span>
                    {i.status === 'open' && i.school_reported_at && <div className="text-muted">You told us it&apos;s paid ({formatDateTime(i.school_reported_at, { day: 'numeric', month: 'short' })}). We&apos;re checking.</div>}
                  </td>
                  <td className="sa-actions">
                    <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => pdf(i)} aria-label={`Download ${i.number}`}>PDF</button>
                    {i.status === 'open' && !i.school_reported_at && (
                      <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => { setNotice(''); setPaying(i) }}>We&apos;ve paid</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

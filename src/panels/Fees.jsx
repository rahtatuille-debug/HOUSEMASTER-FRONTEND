import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDate, formatDateTime } from '../format.js'
import { PAY_METHODS, amount, balanceText, fieldError } from './ChildFees.jsx'
import FeesMpesa from './FeesMpesa.jsx'
import { useRemembered } from '../remember.js'

const VIEWS = [['balances', 'Balances'], ['structure', 'Fee structure'], ['claims', 'To confirm'], ['mpesa', 'M-Pesa'], ['settings', 'Settings']]
const APPLIES = [['all', 'Everyone'], ['boarding', 'Boarders only'], ['day', 'Day students only']]
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// School fees for the bursar and admins: balances, one student's statement, the fee structure per term,
// payments parents say they've made, and the payment details parents see.
export default function Fees() {
  const [view, setView] = useRemembered('panel.fees.view', 'balances')
  const [studentId, setStudentId] = useRemembered('panel.fees.student', null)
  const [openClaims, setOpenClaims] = useState(0)
  const [currency, setCurrency] = useState('')

  useEffect(() => { api.fees.settings().then((s) => setCurrency(s.currency)).catch(() => {}) }, [])

  if (studentId) {
    return <Statement studentId={studentId} onBack={() => setStudentId(null)} />
  }
  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <h2>Fees</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Charge each term&apos;s fees, record payments and send receipts. Parents see their child&apos;s balance and receipts.</p>
        </div>
      </div>
      <div className="guardian-subtabs" role="tablist" aria-label="Fees">
        {VIEWS.map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={view === key} className={view === key ? 'active-filter' : 'secondary'} onClick={() => setView(key)}>
            {label}{key === 'claims' && openClaims > 0 && <span className="nav-count">{openClaims}</span>}
          </button>
        ))}
      </div>
      {view === 'balances' && <Balances onOpen={setStudentId} onClaims={setOpenClaims} />}
      {view === 'structure' && <Structure currency={currency} />}
      {view === 'claims' && <Claims onChange={setOpenClaims} onOpen={setStudentId} />}
      {view === 'mpesa' && <FeesMpesa />}
      {view === 'settings' && <Settings onSaved={(s) => setCurrency(s.currency)} />}
    </div>
  )
}

function Balances({ onOpen, onClaims }) {
  const [classes, setClasses] = useState([])
  const [filters, setFilters] = useState({ school_class: '', owing: '', search: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // A whole school is a long list: show it 100 at a time.
  const [shown, setShown] = useState(100)

  useEffect(() => { setShown(100) }, [filters])
  useEffect(() => { api.schoolClasses.list().then((c) => setClasses(Array.isArray(c) ? c : c.results || [])).catch(() => {}) }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      api.fees.balances(filters).then((d) => { setData(d); onClaims(d.open_claims || 0) }).catch((err) => setError(err.message))
    }, filters.search ? 300 : 0)
    return () => clearTimeout(t)
  }, [filters]) // eslint-disable-line react-hooks/exhaustive-deps

  async function remind() {
    const where = filters.school_class ? classes.find((c) => String(c.id) === String(filters.school_class))?.name : 'the whole school'
    if (!window.confirm(`Email a balance reminder to the parents of every student who owes in ${where}?`)) return
    setError('')
    try {
      const { emailed } = await api.fees.remind(filters.school_class || null)
      setNotice(emailed ? `Emailed ${emailed} parent${emailed === 1 ? '' : 's'}.` : 'Nobody to remind: no parent with an email address has a balance to pay.')
    } catch (err) {
      setError(err.message)
    }
  }

  const set = (key) => (e) => setFilters({ ...filters, [key]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value })
  const cur = data?.currency
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {data && (
        <div className="stat-row fees-stats">
          <div className="stat-tile"><div className="stat-label">Charged</div><div className="stat-value">{amount(data.totals.charged, cur)}</div></div>
          <div className="stat-tile"><div className="stat-label">Paid</div><div className="stat-value">{amount(data.totals.paid, cur)}</div></div>
          <div className="stat-tile"><div className="stat-label">Still to pay</div><div className="stat-value fees-owing">{amount(data.totals.balance, cur)}</div></div>
          <div className="stat-tile"><div className="stat-label">Students owing</div><div className="stat-value">{data.totals.owing}</div></div>
        </div>
      )}
      <div className="card discipline-filters">
        <label>Class
          <select value={filters.school_class} onChange={set('school_class')}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Find a student<input value={filters.search} onChange={set('search')} placeholder="Name or admission no." /></label>
        <label className="checkbox-label"><input type="checkbox" checked={Boolean(filters.owing)} onChange={set('owing')} /> Only those who owe</label>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={remind}>Email reminders</button>
      </div>
      {data === null ? <p className="text-muted">Loading…</p> : data.students.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>No students.</p></div>
      ) : (
        <div className="card table-scroll">
          <table className="dash-table">
            <thead><tr><th>Student</th><th>Class</th><th>Charged</th><th>Paid</th><th>Balance</th></tr></thead>
            <tbody>
              {data.students.slice(0, shown).map((r) => (
                <tr key={r.student}>
                  <td><button type="button" className="link-button" style={{ width: 'auto', padding: 0, textAlign: 'left' }} onClick={() => onOpen(r.student)}>{r.name}</button>
                    {r.external_id && <div className="text-muted">{r.external_id}</div>}</td>
                  <td>{r.class_name || '—'}</td>
                  <td>{amount(r.charged, cur)}</td>
                  <td>{amount(r.paid, cur)}</td>
                  <td className={Number(r.balance) > 0 ? 'fees-owing' : ''}>{balanceText(r.balance, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.students.length > shown && (
            <button type="button" className="secondary" style={{ width: 'auto', marginTop: 12 }} onClick={() => setShown((n) => n + 100)}>
              Show more ({data.students.length - shown} more)
            </button>
          )}
        </div>
      )}
    </>
  )
}

function Statement({ studentId, onBack }) {
  const [data, setData] = useState(null)
  const [payForm, setPayForm] = useState(null)
  const [chargeForm, setChargeForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { api.fees.statement(studentId).then(setData).catch((err) => setError(err.message)) }, [studentId])

  async function run(fn, done) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      setData(await fn())
      if (done) done()
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  const pay = (e) => {
    e.preventDefault()
    run(() => api.fees.addPayment(studentId, payForm), () => { setPayForm(null); setNotice('Payment recorded. The receipt has been emailed to the parents.') })
  }
  const charge = (e) => {
    e.preventDefault()
    run(() => api.fees.addCharge(studentId, chargeForm), () => setChargeForm(null))
  }
  const voidIt = (p) => {
    const reason = window.prompt(`Why is receipt ${p.receipt_number} being cancelled? (e.g. entered twice)`)
    if (reason) run(() => api.fees.voidPayment(p.id, reason))
  }
  const removeCharge = (c) => {
    if (window.confirm(`Remove "${c.description}" from this statement?`)) run(() => api.fees.removeCharge(c.id))
  }
  async function receipt(p) {
    try {
      await api.fees.receipt(p.id)
    } catch (err) {
      setError(err.message)
    }
  }
  const setP = (key) => (e) => setPayForm({ ...payForm, [key]: e.target.value })
  const setC = (key) => (e) => setChargeForm({ ...chargeForm, [key]: e.target.value })

  if (!data) {
    return <div className="panel"><button type="button" className="back-button" onClick={onBack}>← Fees</button>
      {error ? <div className="error-banner" role="alert">{error}</div> : <p className="text-muted">Loading…</p>}</div>
  }
  const cur = data.currency
  return (
    <div className="panel">
      <div className="panel-header"><button type="button" className="back-button" onClick={onBack}>← Fees</button></div>
      <h2>{data.student_name}</h2>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <div className="stat-row fees-stats">
        <div className="stat-tile"><div className="stat-label">Balance</div><div className={`stat-value${Number(data.balance) > 0 ? ' fees-owing' : ''}`}>{balanceText(data.balance, cur)}</div></div>
        <div className="stat-tile"><div className="stat-label">Charged</div><div className="stat-value">{amount(data.charged, cur)}</div></div>
        <div className="stat-tile"><div className="stat-label">Paid</div><div className="stat-value">{amount(data.paid, cur)}</div></div>
      </div>
      <div className="card">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!payForm && <button type="button" style={{ width: 'auto' }} onClick={() => setPayForm({ amount: '', paid_on: localToday(), method: 'mpesa', reference: '', payer_name: '' })}>Record a payment</button>}
          {!chargeForm && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setChargeForm({ kind: 'discount', description: '', amount: '' })}>Add a discount or charge</button>}
        </div>
        {payForm && (
          <form onSubmit={pay} className="tt-form-grid" style={{ marginTop: 12 }} aria-label="Record a payment">
            <label>Amount ({cur})<input type="number" min="1" step="0.01" inputMode="decimal" value={payForm.amount} onChange={setP('amount')} required /></label>
            <label>Paid on<input type="date" max={localToday()} value={payForm.paid_on} onChange={setP('paid_on')} required /></label>
            <label>How<select value={payForm.method} onChange={setP('method')}>{PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label>Reference<input value={payForm.reference} onChange={setP('reference')} maxLength={100} placeholder="e.g. M-Pesa code or slip no." /></label>
            <label>Paid by (optional)<input value={payForm.payer_name} onChange={setP('payer_name')} maxLength={150} /></label>
            <div className="tt-form-actions">
              <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : 'Record and send receipt'}</button>
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setPayForm(null)}>Cancel</button>
            </div>
          </form>
        )}
        {chargeForm && (
          <form onSubmit={charge} className="tt-form-grid" style={{ marginTop: 12 }} aria-label="Add a discount or charge">
            <label>Kind<select value={chargeForm.kind} onChange={setC('kind')}><option value="discount">Discount or bursary (reduces the balance)</option><option value="extra">Extra charge</option></select></label>
            <label>What for<input value={chargeForm.description} onChange={setC('description')} required maxLength={150} placeholder={chargeForm.kind === 'discount' ? 'e.g. Bursary, sibling discount' : 'e.g. Lost textbook'} /></label>
            <label>Amount ({cur})<input type="number" min="1" step="0.01" inputMode="decimal" value={chargeForm.amount} onChange={setC('amount')} required /></label>
            <div className="tt-form-actions">
              <button type="submit" disabled={busy} style={{ width: 'auto' }}>Add</button>
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setChargeForm(null)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      <div className="card table-scroll">
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Charges</h3>
        {data.charges.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None yet. Bill the term from Fee structure.</p> : (
          <table className="dash-table">
            <thead><tr><th>Term</th><th>What</th><th>Amount</th><th></th></tr></thead>
            <tbody>{data.charges.map((c) => (
              <tr key={c.id}>
                <td>{c.term || '—'}</td>
                <td>{c.description}{c.kind !== 'fee' && <span className="text-muted"> · {c.kind_label}</span>}</td>
                <td>{amount(c.amount, cur)}</td>
                <td>{!c.from_fee_item && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => removeCharge(c)} aria-label={`Remove ${c.description}`}>Remove</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
      <div className="card table-scroll">
        <h3 style={{ fontSize: 15, marginTop: 0 }}>Payments</h3>
        {data.payments.length === 0 ? <p className="text-muted" style={{ margin: 0 }}>None yet.</p> : (
          <table className="dash-table">
            <thead><tr><th>Date</th><th>Amount</th><th>How</th><th>Receipt</th><th></th></tr></thead>
            <tbody>{data.payments.map((p) => (
              <tr key={p.id} className={p.voided ? 'fees-voided' : ''}>
                <td>{formatDate(p.paid_on)}</td>
                <td>{amount(p.amount, cur)}</td>
                <td>{p.method_label}{p.reference && <span className="text-muted"> · {p.reference}</span>}
                  {p.voided && <div className="hint" style={{ margin: 0 }}>Cancelled by {p.voided_by_name}: {p.void_reason}</div>}</td>
                <td><button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => receipt(p)} aria-label={`Download receipt ${p.receipt_number}`}>{p.receipt_number}</button></td>
                <td>{!p.voided && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => voidIt(p)} aria-label={`Cancel receipt ${p.receipt_number}`}>Cancel</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function Structure({ currency }) {
  const [terms, setTerms] = useState([])
  const [years, setYears] = useState([])
  const [term, setTerm] = useState('')
  const [items, setItems] = useState(null)
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.terms.list().then((t) => {
      const list = Array.isArray(t) ? t : t.results || []
      setTerms(list)
      const today = localToday()
      const now = list.find((x) => x.start_date && x.end_date && x.start_date <= today && x.end_date >= today) || list[list.length - 1]
      if (now) setTerm(String(now.id))
    }).catch((err) => setError(err.message))
    api.yearGroups.list().then((y) => setYears(Array.isArray(y) ? y : y.results || [])).catch(() => {})
  }, [])
  const load = useCallback(() => { if (term) api.fees.items(term).then(setItems).catch((err) => setError(err.message)) }, [term])
  useEffect(() => { load() }, [load])

  async function add(e) {
    e.preventDefault()
    setError('')
    try {
      await api.fees.addItem({ ...form, term: Number(term), year_group: form.year_group ? Number(form.year_group) : null })
      setForm(null)
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  async function remove(item) {
    setError('')
    try {
      await api.fees.removeItem(item.id)
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  async function bill() {
    const name = terms.find((t) => String(t.id) === term)?.name
    if (!window.confirm(`Charge every student the ${name} fees that apply to them? Students already charged an item aren't charged it again.`)) return
    setError('')
    try {
      const { created } = await api.fees.billTerm(Number(term))
      setNotice(created ? `Done: ${created} charges added.` : 'Everyone has already been charged these fees.')
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <div className="card discipline-filters">
        <label>Term
          <select value={term} onChange={(e) => { setTerm(e.target.value); setNotice('') }}>
            {terms.length === 0 && <option value="">No terms yet (add them in Setup)</option>}
            {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        {term && !form && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm({ name: '', amount: '', year_group: '', applies_to: 'all' })}>Add a fee item</button>}
        {term && items?.length > 0 && <button type="button" style={{ width: 'auto' }} onClick={bill}>Bill this term</button>}
      </div>
      {form && (
        <form onSubmit={add} className="card tt-form-grid" aria-label="Add a fee item">
          <label>Name<input value={form.name} onChange={set('name')} required maxLength={100} placeholder="e.g. Tuition, Boarding, Lunch" /></label>
          <label>Amount ({currency})<input type="number" min="1" step="0.01" inputMode="decimal" value={form.amount} onChange={set('amount')} required /></label>
          <label>Year group<select value={form.year_group} onChange={set('year_group')}><option value="">Every year group</option>{years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}</select></label>
          <label>Who pays<select value={form.applies_to} onChange={set('applies_to')}>{APPLIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <div className="tt-form-actions">
            <button type="submit" style={{ width: 'auto' }}>Add</button>
            <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm(null)}>Cancel</button>
          </div>
        </form>
      )}
      {items === null ? (term && <p className="text-muted">Loading…</p>) : items.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>No fee items for this term yet. Add tuition, boarding and anything else, then press &quot;Bill this term&quot;.</p></div>
      ) : (
        <div className="card table-scroll">
          <table className="dash-table">
            <thead><tr><th>Item</th><th>Amount</th><th>Year group</th><th>Who pays</th><th>Charged to</th><th></th></tr></thead>
            <tbody>{items.map((i) => (
              <tr key={i.id}>
                <td>{i.name}</td><td>{amount(i.amount, currency)}</td><td>{i.year_group_name || 'Every year group'}</td>
                <td>{i.applies_to_label}</td><td>{i.billed ? `${i.billed} students` : 'Not billed yet'}</td>
                <td>{!i.billed && <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => remove(i)} aria-label={`Remove ${i.name}`}>Remove</button>}</td>
              </tr>
            ))}</tbody>
          </table>
          <p className="hint" style={{ marginBottom: 0 }}>Billing again only charges students who don&apos;t have an item yet (e.g. new students). To change one student&apos;s fees, open them in Balances and add a discount or charge.</p>
        </div>
      )}
    </>
  )
}

function Claims({ onChange, onOpen }) {
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const load = useCallback(() => {
    api.fees.claims('open').then((r) => { setRows(r); onChange(r.length) }).catch((err) => setError(err.message))
  }, [onChange])
  useEffect(() => { load() }, [load])

  async function confirm(c) {
    const got = window.prompt(`Confirm the payment for ${c.student_name}. Amount received:`, String(Number(c.amount)))
    if (!got) return
    setError('')
    try {
      await api.fees.confirmClaim(c.id, got)
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  async function reject(c) {
    const reason = window.prompt(`Tell ${c.claimed_by_name} why it couldn't be confirmed:`, 'We could not find a payment with that reference.')
    if (!reason) return
    setError('')
    try {
      await api.fees.rejectClaim(c.id, reason)
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {rows === null ? <p className="text-muted">Loading…</p> : rows.length === 0 ? (
        <div className="card"><p className="text-muted" style={{ margin: 0 }}>Nothing to check. When a parent says they&apos;ve paid, it appears here.</p></div>
      ) : (
        <div className="card">
          <p className="hint" style={{ marginTop: 0 }}>Check each against your M-Pesa or bank statement. Confirming records the payment and emails the receipt.</p>
          <ul className="support-list">
            {rows.map((c) => (
              <li key={c.id}>
                <div className="support-row">
                  <div>
                    <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => onOpen(c.student)}><strong>{c.student_name}</strong></button>
                    {c.class_name && <span className="text-muted"> · {c.class_name}</span>}
                    <div>{amount(c.amount)} on {formatDate(c.paid_on)} · {c.method_label} · <code>{c.reference}</code></div>
                    <div className="hint" style={{ margin: 0 }}>From {c.claimed_by_name}, {formatDateTime(c.created_at, { day: 'numeric', month: 'short' })}{c.note && ` · ${c.note}`}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={{ width: 'auto' }} onClick={() => confirm(c)} aria-label={`Confirm ${c.student_name}'s payment`}>Confirm</button>
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => reject(c)} aria-label={`Can't find ${c.student_name}'s payment`}>Can&apos;t find it</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function Settings({ onSaved }) {
  const [form, setForm] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { api.fees.settings().then(setForm).catch((err) => setError(err.message)) }, [])
  async function save(e) {
    e.preventDefault()
    setError('')
    try {
      const s = await api.fees.saveSettings(form)
      setForm(s)
      onSaved(s)
      setNotice('Saved.')
    } catch (err) {
      setError(fieldError(err))
    }
  }
  if (!form) return error ? <div className="error-banner" role="alert">{error}</div> : <p className="text-muted">Loading…</p>
  return (
    <form className="card" onSubmit={save} aria-label="Fee settings">
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <label>Currency<input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} maxLength={3} style={{ maxWidth: 120 }} /></label>
      <label>How parents pay (shown to parents and in reminders)
        <textarea rows={4} value={form.payment_instructions} onChange={(e) => setForm({ ...form, payment_instructions: e.target.value })} maxLength={1000}
          placeholder="e.g. M-Pesa Paybill 247247, account: the student's admission number" />
      </label>
      <button type="submit" style={{ width: 'auto' }}>Save</button>
    </form>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime } from '../format.js'
import { amount, fieldError } from './ChildFees.jsx'

const BLANK = { kind: 'paybill', shortcode: '', till_number: '', environment: 'sandbox', enabled: true, consumer_key: '', consumer_secret: '', passkey: '' }

// The school's own M-Pesa paybill or till: connect it, and give a student to paybill payments whose
// account number didn't match anyone.
export default function FeesMpesa({ onUnmatched }) {
  const [account, setAccount] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    api.fees.mpesa().then((a) => { setAccount(a); if (!a.connected) setForm({ ...BLANK, ...pick(a) }) }).catch((err) => setError(err.message))
  }, [])

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const saved = await api.fees.saveMpesa(form)
      setAccount(saved)
      setForm(null)
      setNotice(saved.c2b_registered_at ? 'Saved.' : 'Saved. Now press "Connect" so payments straight to the paybill are recorded too.')
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }

  async function connect() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      setAccount(await api.fees.connectMpesa())
      setNotice('Connected. Payments to your paybill with a student\'s admission number as the account are now recorded by themselves.')
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }

  if (!account) return error ? <div className="error-banner" role="alert">{error}</div> : <p className="text-muted">Loading…</p>
  return (
    <>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      {!account.server_ready && <div className="error-banner" role="alert">M-Pesa isn&apos;t switched on for HouseMaster yet. Please try again later.</div>}
      {!account.currency_ok && <div className="error-banner" role="alert">M-Pesa takes shillings: set the currency to KES in Settings first.</div>}
      <div className="card">
        <div className="support-row">
          <div>
            <h3 style={{ fontSize: 15, margin: 0 }}>Your M-Pesa</h3>
            {account.connected ? (
              <p style={{ margin: '4px 0 0' }}>
                {account.kind === 'till' ? `Till ${account.till_number} (store ${account.shortcode})` : `Paybill ${account.shortcode}`}
                {' · '}{account.environment === 'production' ? 'Live' : 'Sandbox (testing)'}
                {' · '}{account.enabled ? 'On' : 'Off'}
                {account.c2b_registered_at ? ` · connected ${formatDateTime(account.c2b_registered_at, { day: 'numeric', month: 'short' })}` : ' · not connected yet'}
              </p>
            ) : <p className="hint" style={{ margin: '4px 0 0' }}>Not set up. Parents can pay by M-Pesa once you add your paybill or till.</p>}
          </div>
          {account.connected && !form && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" style={{ width: 'auto' }} disabled={busy} onClick={connect}>{account.c2b_registered_at ? 'Connect again' : 'Connect'}</button>
              <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm({ ...BLANK, ...pick(account) })}>Change</button>
            </div>
          )}
        </div>
        {form && (
          <form onSubmit={save} className="tt-form-grid" style={{ marginTop: 12 }} aria-label="M-Pesa details">
            <p className="hint" style={{ gridColumn: '1 / -1', margin: 0 }}>
              From Safaricom&apos;s Daraja portal (developer.safaricom.co.ke): create an app for your paybill or till with M-Pesa Express and C2B,
              then go live. Enter its details here. The keys are stored encrypted and never shown again.
            </p>
            <label>Type<select value={form.kind} onChange={set('kind')}><option value="paybill">Paybill</option><option value="till">Till (Buy Goods)</option></select></label>
            <label>{form.kind === 'till' ? 'Store number (head office)' : 'Paybill number'}<input inputMode="numeric" value={form.shortcode} onChange={set('shortcode')} required /></label>
            {form.kind === 'till' && <label>Till number<input inputMode="numeric" value={form.till_number} onChange={set('till_number')} required /></label>}
            <label>Mode<select value={form.environment} onChange={set('environment')}><option value="sandbox">Sandbox (testing)</option><option value="production">Live</option></select></label>
            <label>Consumer key<input value={form.consumer_key} onChange={set('consumer_key')} autoComplete="off" placeholder={account.keys_saved ? 'Saved (leave blank to keep)' : ''} /></label>
            <label>Consumer secret<input type="password" value={form.consumer_secret} onChange={set('consumer_secret')} autoComplete="off" placeholder={account.keys_saved ? 'Saved (leave blank to keep)' : ''} /></label>
            <label>Passkey<input type="password" value={form.passkey} onChange={set('passkey')} autoComplete="off" placeholder={account.keys_saved ? 'Saved (leave blank to keep)' : ''} /></label>
            <label className="checkbox-label"><input type="checkbox" checked={form.enabled} onChange={set('enabled')} /> Parents can pay by M-Pesa</label>
            <div className="tt-form-actions">
              <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Saving…' : 'Save'}</button>
              {account.connected && <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => setForm(null)}>Cancel</button>}
            </div>
          </form>
        )}
        <p className="hint" style={{ marginBottom: 0 }}>
          Parents pay with &quot;Pay with M-Pesa&quot; on their child&apos;s Fees tab, or straight to your paybill with the student&apos;s admission number as the account.
          Both are recorded and receipted by themselves.
        </p>
      </div>
      <PaybillPayments onUnmatched={onUnmatched} />
    </>
  )
}

function pick(a) {
  return { kind: a.kind, shortcode: a.shortcode, till_number: a.till_number, environment: a.environment, enabled: a.enabled || !a.connected }
}

function PaybillPayments({ onUnmatched }) {
  const [rows, setRows] = useState(null)
  const [all, setAll] = useState(false)
  const [choosing, setChoosing] = useState(null)
  const [search, setSearch] = useState('')
  const [matches, setMatches] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api.fees.mpesaPayments(all ? 'all' : 'unmatched').then((r) => {
      setRows(r)
      if (!all) onUnmatched?.(r.length)
    }).catch((err) => setError(err.message))
  }, [all, onUnmatched])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!choosing || search.trim().length < 2) { setMatches([]); return undefined }
    const t = setTimeout(() => api.fees.balances({ search }).then((d) => setMatches(d.students.slice(0, 8))).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [search, choosing])

  async function act(fn) {
    setError('')
    try {
      await fn()
      setChoosing(null)
      setSearch('')
      load()
    } catch (err) {
      setError(fieldError(err))
    }
  }

  return (
    <div className="card">
      <div className="support-row">
        <h3 style={{ fontSize: 15, margin: 0 }}>Payments to the paybill</h3>
        <label className="checkbox-label" style={{ margin: 0 }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> Show all</label>
      </div>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!all && <p className="hint">These came in with an account number that isn&apos;t a student&apos;s admission number. Choose who each was for.</p>}
      {rows === null ? <p className="text-muted">Loading…</p> : rows.length === 0 ? (
        <p className="text-muted" style={{ margin: 0 }}>{all ? 'None yet.' : 'Nothing to sort out.'}</p>
      ) : (
        <ul className="support-list">
          {rows.map((r) => (
            <li key={r.id}>
              <div className="support-row">
                <div>
                  <strong>{amount(r.amount, 'KES')}</strong> · {r.payer_name || 'M-Pesa'} {r.phone && <span className="text-muted">({r.phone})</span>}
                  <div className="hint" style={{ margin: 0 }}>
                    {formatDateTime(r.paid_at, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · code <code>{r.trans_id}</code> · account typed: &quot;{r.bill_ref || '—'}&quot;
                    {r.status !== 'unmatched' && ` · ${r.status_label}${r.student_name ? `: ${r.student_name}` : ''}${r.receipt_number ? ` (${r.receipt_number})` : ''}`}
                  </div>
                </div>
                {r.status === 'unmatched' && choosing !== r.id && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" style={{ width: 'auto' }} onClick={() => { setChoosing(r.id); setSearch('') }}>Choose student</button>
                    <button type="button" className="secondary" style={{ width: 'auto' }} onClick={() => act(() => api.fees.ignoreMpesa(r.id))}
                      aria-label={`${r.trans_id} isn't for fees`}>Not fees</button>
                  </div>
                )}
              </div>
              {choosing === r.id && (
                <div className="mpesa-assign">
                  <label>Student<input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or admission no." /></label>
                  {matches.map((m) => (
                    <button key={m.student} type="button" className="secondary" style={{ width: 'auto' }}
                      onClick={() => act(() => api.fees.assignMpesa(r.id, m.student))}>
                      {m.name}{m.class_name && ` · ${m.class_name}`}{m.external_id && ` · ${m.external_id}`}
                    </button>
                  ))}
                  <button type="button" className="link-button" style={{ width: 'auto' }} onClick={() => setChoosing(null)}>Cancel</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

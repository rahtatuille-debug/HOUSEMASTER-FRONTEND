import { useEffect, useState } from 'react'
import PrivacyNotice, { PrivacyConsent } from './PrivacyNotice.jsx'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

// The page the school's staff sign-up link opens: a new member of staff asks to join. An admin checks each
// request and emails them a link to choose their password.
export default function StaffJoin({ token, onSignIn }) {
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', note: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.staffJoinInfo(token).then(setInfo).catch((err) => setLoadError(err.message))
  }, [token])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await api.staffJoinAsk(token, { ...form, accept_privacy: agreed })
      setDone(result.detail)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <LogoFull />
        <p className="tagline">Staff sign-up</p>
        {loadError && <div className="error-banner">{loadError}</div>}
        {done && <div className="success-banner" role="status">{done}</div>}
        {info && !done && (
          <>
            <p className="hint" style={{ marginBottom: 18 }}>
              Join <strong>{info.school_name}</strong> on HouseMaster as a member of staff. An admin will check your
              details and email you a link to choose your password.
            </p>
            {error && <div className="error-banner" role="alert">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="sj-name">Your full name</label>
                <input id="sj-name" value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="sj-email">Email</label>
                <input id="sj-email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
                <p className="hint" style={{ margin: '4px 0 0' }}>You&apos;ll sign in with this email.</p>
              </div>
              <div className="field">
                <label htmlFor="sj-phone">Phone (optional)</label>
                <input id="sj-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder={info.country?.phone_example} />
              </div>
              <div className="field">
                <label htmlFor="sj-note">What do you teach? (optional)</label>
                <input id="sj-note" value={form.note} onChange={set('note')} maxLength={300} placeholder="e.g. Year 8 Maths and Science" />
              </div>
              <PrivacyNotice schoolName={info.school_name} contact={info.privacy_contact} country={info.country} audience="staff" />
              <PrivacyConsent checked={agreed} onChange={setAgreed} />
              <button type="submit" disabled={submitting || !agreed} style={{ width: '100%' }}>
                {submitting ? 'Sending…' : 'Ask to join'}
              </button>
            </form>
          </>
        )}
        <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>
          Already have an account?{' '}
          <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={onSignIn}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  )
}

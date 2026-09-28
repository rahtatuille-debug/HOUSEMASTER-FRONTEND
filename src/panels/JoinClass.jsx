import { useEffect, useState } from 'react'
import PrivacyNotice, { PrivacyConsent } from './PrivacyNotice.jsx'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

const RELATIONSHIPS = [
  ['mother', 'Mother'], ['father', 'Father'], ['guardian', 'Guardian'], ['grandparent', 'Grandparent'],
  ['sibling', 'Sibling'], ['other', 'Other relative'],
]

// The page a class sign-up link opens: a parent asks to join by giving their
// details and their child's admission number. The school checks each request
// and emails the parent a link to set their password.
export default function JoinClass({ token, onSignIn }) {
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', relationship: '', admission_number: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api.joinInfo(token).then(setInfo).catch((err) => setLoadError(err.message))
  }, [token])

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await api.joinClass(token, { ...form, accept_privacy: agreed })
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
        <p className="tagline">Parent/Guardian sign-up</p>

        {loadError && <div className="error-banner">{loadError}</div>}

        {done && (
          <>
            <div className="success-banner">{done}</div>
            <p className="hint">
              Have a child in another class? Use that class&apos;s link too, with the same email, and both
              children will be on one account.
            </p>
          </>
        )}

        {info && !done && (
          <>
            <p className="hint" style={{ marginBottom: 18 }}>
              Join <strong>{info.school_name}</strong> on HouseMaster as the parent or guardian of a student in{' '}
              <strong>{info.year_group} · {info.class_name}</strong>. The school will check your details and email
              you a link to set your password.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="join-name">Your full name</label>
                <input id="join-name" value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
              </div>
              <div className="field">
                <label htmlFor="join-email">Email</label>
                <input id="join-email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
              </div>
              <div className="field">
                <label htmlFor="join-phone">Phone</label>
                <input id="join-phone" type="tel" value={form.phone} onChange={set('phone')} autoComplete="tel"
                  placeholder={info.country?.phone_example} />
              </div>
              <div className="field">
                <label htmlFor="join-relationship">You are the child&apos;s</label>
                <select id="join-relationship" value={form.relationship} onChange={set('relationship')}>
                  <option value="">Choose…</option>
                  {RELATIONSHIPS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="join-admission">Child&apos;s admission number</label>
                <input id="join-admission" value={form.admission_number} onChange={set('admission_number')} required
                  autoComplete="off" />
                <p className="hint" style={{ margin: '4px 0 0' }}>As it appears on the school&apos;s records, e.g. on a report card or fee receipt.</p>
              </div>
              <PrivacyNotice schoolName={info.school_name} contact={info.privacy_contact} country={info.country} audience="parent" />
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

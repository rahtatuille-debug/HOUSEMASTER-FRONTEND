import { useState } from 'react'
import { api } from '../api.js'
import PrivacyNotice, { PrivacyConsent } from './PrivacyNotice.jsx'

// Public sign-up for a new school. The person registering becomes its first
// admin and goes straight into the setup wizard.
export default function RegisterSchool({ onRegistered, onBack }) {
  const [form, setForm] = useState({ school_name: '', name: '', email: '', password: '', confirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await api.registerSchool({
        school_name: form.school_name.trim(), name: form.name.trim(), email: form.email.trim(),
        password: form.password, accept_privacy: agreed,
      })
      onRegistered()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>HouseMaster</h1>
        <p className="tagline">Register your school</p>
        <p className="hint" style={{ marginTop: 0 }}>
          You'll be the school's first administrator. Next, a short setup takes you through your education system,
          classes, subjects and terms.
        </p>
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="reg-school">School name</label>
            <input id="reg-school" value={form.school_name} onChange={set('school_name')} required minLength={2} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="reg-name">Your full name</label>
            <input id="reg-name" value={form.name} onChange={set('name')} required minLength={2} />
          </div>
          <div className="field">
            <label htmlFor="reg-email">Your email</label>
            <input id="reg-email" type="email" value={form.email} onChange={set('email')} required />
          </div>
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input id="reg-password" type="password" value={form.password} onChange={set('password')} required />
          </div>
          <div className="field">
            <label htmlFor="reg-confirm">Confirm password</label>
            <input id="reg-confirm" type="password" value={form.confirm} onChange={set('confirm')} required />
          </div>
          <PrivacyNotice schoolName={form.school_name.trim() || 'Your school'} audience="staff" />
          <PrivacyConsent checked={agreed} onChange={setAgreed} />
          <button type="submit" disabled={submitting || !agreed} style={{ width: '100%' }}>
            {submitting ? 'Creating your school…' : 'Register and start setup'}
          </button>
        </form>
        <button type="button" className="link-button" onClick={onBack}>Already have an account? Sign in</button>
      </div>
    </div>
  )
}

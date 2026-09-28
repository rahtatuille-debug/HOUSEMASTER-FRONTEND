import { useState } from 'react'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

export default function ForgotPassword({ onBack }) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.requestPasswordReset(email)
      // The API answers the same way whether or not an account uses this
      // email, so this screen can't be used to find out which addresses are
      // registered. We show the same message either way.
      setSent(true)
    } catch (err) {
      setError(err.message || 'Could not request a reset link.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <LogoFull />
        <p className="tagline">Reset your password</p>

        {sent ? (
          <>
            <div className="success-banner">
              If that email has an account, we've sent a reset link to it.
            </div>
            <button type="button" className="secondary" style={{ width: '100%' }} onClick={onBack}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 18 }}>
              Enter the email address you sign in with and we'll email you a link to choose a new password.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="forgot-email">Email address</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button type="submit" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
            <button type="button" className="link-button" onClick={onBack}>
              Back to sign in
            </button>
          </>
        )}
      </div>
    </div>
  )
}

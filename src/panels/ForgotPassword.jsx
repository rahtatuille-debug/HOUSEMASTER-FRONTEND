import { useState } from 'react'
import { api } from '../api.js'

export default function ForgotPassword({ onBack }) {
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.requestPasswordReset(username)
      // The API always returns success here, whether or not the username
      // exists — so this screen can't be used to test which usernames are
      // registered. We just show the same message either way.
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
        <h1>HouseMaster</h1>
        <p className="tagline">Reset your password</p>

        {sent ? (
          <>
            <div className="success-banner">
              If that account exists, we've sent a reset link to its email address.
            </div>
            <button type="button" className="secondary" style={{ width: '100%' }} onClick={onBack}>
              Back to sign in
            </button>
          </>
        ) : (
          <>
            <p className="hint" style={{ marginBottom: 18 }}>
              Enter your username and we'll email you a link to choose a new password.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="forgot-username">Username</label>
                <input
                  id="forgot-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
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

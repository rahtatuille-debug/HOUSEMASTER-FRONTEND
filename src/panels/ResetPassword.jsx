import { useState } from 'react'
import { api } from '../api.js'

// Unlike AcceptInvite, there's no preview endpoint for a reset token — the
// backend only validates it when the new password is actually submitted,
// so an invalid/expired/used link just surfaces as a form error rather
// than an upfront banner.
export default function ResetPassword({ token, onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await api.confirmPasswordReset(token, password)
      onDone()
    } catch (err) {
      setError(err.message || 'Could not reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>HouseMaster</h1>
        <p className="tagline">Choose a new password</p>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="reset-password">New password</label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reset-confirm">Confirm new password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}

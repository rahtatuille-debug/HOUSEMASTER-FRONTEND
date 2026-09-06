import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { displayRole } from '../user.js'

export default function AcceptInvite({ token, onAccepted }) {
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .previewInvite(token)
      .then(setPreview)
      .catch((err) => setPreviewError(err.message))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      // Only a password is set here — the account's email (and school and
      // role) were already fixed by the admin when the invite was made.
      await api.acceptInvite(token, password)
      onAccepted()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>HouseMaster</h1>
        <p className="tagline">Accept your invite</p>

        {previewError && <div className="error-banner">{previewError}</div>}

        {preview && preview.status !== 'pending' && (
          <div className="error-banner">
            This invite has already been {preview.status === 'accepted' ? 'used' : 'expired'}.
            Ask your admin to send a new one.
          </div>
        )}

        {preview && preview.status === 'pending' && (
          <>
            <p className="hint" style={{ marginBottom: 18 }}>
              You're joining <strong>{preview.school_name}</strong> as{' '}
              <strong>{preview.name || 'School staff'} · {displayRole(preview.role)}</strong>, signing in as <strong>{preview.email}</strong>.
              Choose a password to finish.
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="invite-password">Password</label>
                <input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="invite-confirm">Confirm password</label>
                <input
                  id="invite-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button type="submit" disabled={submitting} style={{ width: '100%' }}>
                {submitting ? 'Creating account…' : 'Create account & sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

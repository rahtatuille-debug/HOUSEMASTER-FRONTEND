import { useEffect, useState } from 'react'
import PrivacyNotice, { PrivacyConsent } from './PrivacyNotice.jsx'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'
import { displayRole } from '../user.js'

export default function AcceptInvite({ token, onAccepted }) {
  const [preview, setPreview] = useState(null)
  const [previewError, setPreviewError] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    api
      .previewInvite(token)
      .then(setPreview)
      .catch((err) => setPreviewError(err.message))
  }, [token])

  // Already signs in to HouseMaster (another school, or staff and parent): this school is added to that
  // account with its password, instead of a new password being chosen.
  const existing = !!preview?.has_account

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!existing && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      // Only a password is set here — the account's email (and school and
      // role) were already fixed by the admin when the invite was made.
      await api.acceptInvite(token, password, agreed)
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
        <LogoFull />
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
              {existing
                ? <> You already sign in to HouseMaster with this email: enter that password to add {preview.school_name} to your account.</>
                : ' Choose a password to finish.'}
            </p>
            {error && <div className="error-banner">{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="invite-password">{existing ? 'Your HouseMaster password' : 'Password'}</label>
                <input
                  id="invite-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {!existing && (
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
              )}
              <PrivacyNotice schoolName={preview.school_name} contact={preview.privacy_contact} country={preview.country} audience="staff" />
              <PrivacyConsent checked={agreed} onChange={setAgreed} />
              <button type="submit" disabled={submitting || !agreed} style={{ width: '100%' }}>
                {submitting ? (existing ? 'Joining…' : 'Creating account…') : existing ? `Join ${preview.school_name} & sign in` : 'Create account & sign in'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

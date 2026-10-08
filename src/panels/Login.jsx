import { useState } from 'react'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

export default function Login({ onLoggedIn, onForgotPassword, onRegister, successMessage }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await api.login(email, password)
      onLoggedIn()
    } catch (err) {
      setError(err.message || 'Could not log in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <LogoFull />
        <p className="tagline">Sign in</p>
        {successMessage && <div className="success-banner">{successMessage}</div>}
        {error && <div className="error-banner">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email or student username</label>
            <input
              id="email"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" disabled={submitting} style={{ width: '100%' }}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        {onForgotPassword && (
          <button type="button" className="link-button" onClick={onForgotPassword}>
            Forgot password?
          </button>
        )}
        {onRegister && (
          <p className="text-muted" style={{ fontSize: 13, margin: '14px 0 0', textAlign: 'center' }}>
            New to HouseMaster?{' '}
            <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={onRegister}>
              Register your school
            </button>
          </p>
        )}
      </div>
    </div>
  )
}

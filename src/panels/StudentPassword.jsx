import { useState } from 'react'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

const fieldError = (err) => Object.values(err.data || {}).flat().find((v) => typeof v === 'string') || err.message

// The form itself: the password they were given (or their current one) and a new one, twice.
function PasswordForm({ first, onDone }) {
  const [form, setForm] = useState({ current: '', next: '', again: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    if (form.next !== form.again) { setError("The new passwords don't match."); return }
    setBusy(true)
    setError('')
    try {
      await api.student.changePassword({ current_password: form.current, new_password: form.next })
      setForm({ current: '', next: '', again: '' })
      onDone()
    } catch (err) {
      setError(fieldError(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit}>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="field">
        <label htmlFor="sp-current">{first ? 'The password you were given' : 'Your current password'}</label>
        <input id="sp-current" type="password" value={form.current} onChange={set('current')} required autoComplete="current-password" />
      </div>
      <div className="field">
        <label htmlFor="sp-next">New password</label>
        <input id="sp-next" type="password" value={form.next} onChange={set('next')} required minLength={10} autoComplete="new-password" />
      </div>
      <div className="field">
        <label htmlFor="sp-again">New password again</label>
        <input id="sp-again" type="password" value={form.again} onChange={set('again')} required minLength={10} autoComplete="new-password" />
      </div>
      <p className="hint">At least 10 characters. A few words with a number is easy to remember and hard to guess. Don&apos;t share it with anyone.</p>
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : first ? 'Save and continue' : 'Change password'}</button>
    </form>
  )
}

// The first time a student signs in they choose their own password before anything else.
export function ChooseFirstPassword({ me, onDone, onLogout }) {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <LogoFull />
        <p className="tagline">Welcome{me?.first_name ? `, ${me.first_name}` : ''}</p>
        <p>Choose your own password. You&apos;ll use it with your username, <strong>{me?.username}</strong>, from now on.</p>
        <PasswordForm first onDone={onDone} />
        <button type="button" className="link-button" onClick={onLogout}>Sign out</button>
      </div>
    </div>
  )
}

// A student's Profile page: who they are and changing their password.
export default function StudentProfile({ me, embedded = false }) {
  const [done, setDone] = useState(false)
  return (
    <div>
      {!embedded && <div className="panel-header"><div><h2>Profile</h2></div></div>}
      {!embedded && (
        <div className="card">
          <p style={{ margin: 0 }}><strong>{me?.name}</strong>{me?.class_name ? ` · ${me.class_name}` : ''}</p>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Username: {me?.username}</p>
        </div>
      )}
      <div className="card settings-card">
        <h3>Change your password</h3>
        {done && <div className="success-banner" role="status">Your password was changed.</div>}
        <PasswordForm onDone={() => setDone(true)} />
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { getRoleLabel } from '../user.js'
import { ContactForm } from './ParentContact.jsx'
import PrivacyNotice from './PrivacyNotice.jsx'
import { NotificationsBlocked, currentSubscription, pushRegistration, turnOff, turnOn } from '../push.js'

export default function Profile({ me, identityKind, onUserUpdated }) {
  const [name, setName] = useState(me?.name || '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const isGuardian = identityKind === 'guardian'

  useEffect(() => {
    setName(me?.name || '')
  }, [me?.name])

  async function save(e) {
    e.preventDefault()
    const displayName = name.trim()
    setError('')
    setSuccess('')
    if (displayName.length < 2 || displayName.length > 255) {
      setError('Display name must be between 2 and 255 characters.')
      return
    }
    setSaving(true)
    try {
      const updated = isGuardian
        ? await api.updateGuardianMe({ name: displayName })
        : await api.updateMe({ name: displayName })
      onUserUpdated({ ...me, ...updated, name: updated?.name || displayName })
      setSuccess('Your display name has been updated.')
    } catch (err) {
      setError(err.message || 'Could not update your display name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <div className="panel-header"><h2>Profile</h2></div>
      <form className="card profile-card" onSubmit={save}>
        {error && <div className="error-banner">{error}</div>}
        {success && <div className="success-banner" role="status">{success}</div>}
        <div className="field">
          <label htmlFor="display-name">Display name</label>
          <input id="display-name" value={name} onChange={(e) => setName(e.target.value)} minLength="2" maxLength="255" required />
        </div>
        {!isGuardian && (
          <div className="profile-readonly"><span>Role</span><strong>{getRoleLabel(me?.role)}</strong></div>
        )}
        <div className="profile-readonly"><span>School</span><strong>{me?.school?.name || '—'}</strong></div>
        {isGuardian && (
          <div className="profile-readonly">
            <span>Children</span>
            <strong>{me?.students?.map((s) => `${s.first_name} ${s.last_name}`).join(', ') || '—'}</strong>
          </div>
        )}
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
      {isGuardian && me?.contact && <GuardianContactCard me={me} onUserUpdated={onUserUpdated} />}
      <details className="card profile-card">
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Privacy notice</summary>
        <PrivacyNotice schoolName={me?.school?.name} contact={me?.school?.privacy_contact} country={me?.school?.country} audience={isGuardian ? 'parent' : 'staff'} />
      </details>
    </section>
  )
}

// Parents keep their own phone numbers and address up to date for the school.
function GuardianContactCard({ me, onUserUpdated }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function save(form) {
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const updated = await api.updateGuardianMe(form)
      onUserUpdated({ ...me, ...updated })
      setSuccess('Your contact details have been saved.')
    } catch (err) {
      setError(err.message || 'Could not save your contact details.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card profile-card">
      <h3 style={{ fontSize: 15, marginBottom: 6 }}>Your contact details</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        The school uses these to reach you about your children. Your children's teachers can see your phone numbers.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner" role="status">{success}</div>}
      <ContactForm parent={me.contact} saving={saving} onSave={save} idPrefix="my-contact" />
      <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={!!me.contact.email_notifications}
            disabled={saving}
            onChange={(e) => save({ email_notifications: e.target.checked })}
          />
          Email me when the school publishes an announcement or a report for my children
        </label>
      </div>
      <PushToggle />
    </div>
  )
}

// Notices on this phone or browser, as well as (or instead of) email. Shown only
// when the school's server is set up for it and this browser can do it.
function PushToggle() {
  const [state, setState] = useState(null) // {registration, publicKey, on}
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      const registration = await pushRegistration()
      if (!registration) return
      const sub = await currentSubscription(registration)
      const settings = await api.push.settings(sub?.endpoint).catch(() => null)
      if (live && settings?.enabled) setState({ registration, publicKey: settings.public_key, on: !!sub && settings.subscribed })
    })()
    return () => { live = false }
  }, [])

  if (!state) return null
  async function toggle(on) {
    setBusy(true)
    setError('')
    try {
      if (on) await turnOn(state.registration, state.publicKey)
      else await turnOff(state.registration)
      setState({ ...state, on })
    } catch (err) {
      setError(err instanceof NotificationsBlocked
        ? 'This browser has blocked notifications from HouseMaster. Allow them in the browser or phone settings, then try again.'
        : (err.message || 'Could not change notifications.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
      {error && <div className="error-banner" role="alert">{error}</div>}
      <label className="checkbox-label">
        <input type="checkbox" checked={state.on} disabled={busy} onChange={(e) => toggle(e.target.checked)} />
        Notify me on this phone or browser too
      </label>
      <p className="hint" style={{ margin: '4px 0 0' }}>
        A short notice, with no names, when there is a new announcement or report. Turn it on separately on each device.
        On an iPhone, add HouseMaster to your home screen first.
      </p>
    </div>
  )
}

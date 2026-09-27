import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { getRoleLabel } from '../user.js'
import { ContactForm } from './ParentContact.jsx'

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
    </div>
  )
}

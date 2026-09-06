import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { getRoleLabel } from '../user.js'

export default function Profile({ me, onUserUpdated }) {
  const [name, setName] = useState(me?.name || '')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)

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
      const updated = await api.updateMe({ name: displayName })
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
        <div className="profile-readonly"><span>Role</span><strong>{getRoleLabel(me?.role)}</strong></div>
        <div className="profile-readonly"><span>School</span><strong>{me?.school?.name || '—'}</strong></div>
        <div className="form-actions"><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button></div>
      </form>
    </section>
  )
}

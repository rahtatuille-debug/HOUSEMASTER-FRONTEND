import { useState } from 'react'

export const RELATIONSHIPS = {
  mother: 'Mother',
  father: 'Father',
  guardian: 'Guardian',
  grandparent: 'Grandparent',
  sibling: 'Sibling',
  other: 'Other relative',
}

export const CONTACT_METHODS = {
  call: 'Phone call',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
}

const FIELDS = ['phone', 'phone_alt', 'relationship', 'preferred_contact', 'occupation', 'address']

// A parent's contact details as a list of label/value pairs. Only the fields
// present on `parent` are shown, so teachers (who aren't sent the address or
// admin note) simply don't see those rows.
export function ContactDetails({ parent, showEmail = true }) {
  const rows = [
    ['Relationship', RELATIONSHIPS[parent.relationship]],
    ['Phone', parent.phone && <a href={`tel:${parent.phone.replace(/[^+\d]/g, '')}`}>{parent.phone}</a>],
    ['Second phone', parent.phone_alt && <a href={`tel:${parent.phone_alt.replace(/[^+\d]/g, '')}`}>{parent.phone_alt}</a>],
    showEmail && ['Email', parent.email && <a href={`mailto:${parent.email}`}>{parent.email}</a>],
    ['Prefers', CONTACT_METHODS[parent.preferred_contact]],
    'occupation' in parent && ['Occupation', parent.occupation],
    'address' in parent && ['Home address', parent.address],
    'admin_note' in parent && ['Admin note', parent.admin_note],
  ].filter(Boolean)
  return (
    <dl className="contact-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={value ? undefined : 'text-muted'}>{value || 'Not given'}</dd>
        </div>
      ))}
    </dl>
  )
}

// Form for the contact fields. `withNote` adds the admin-only private note.
export function ContactForm({ parent, withNote = false, saving, onSave, onCancel, idPrefix = 'pc' }) {
  const [form, setForm] = useState(() => {
    const initial = Object.fromEntries(FIELDS.map((f) => [f, parent[f] || '']))
    if (withNote) initial.admin_note = parent.admin_note || ''
    return initial
  })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const id = (key) => `${idPrefix}-${key}`

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(form) }}>
      <div className="form-row">
        <div className="field">
          <label htmlFor={id('phone')}>Phone</label>
          <input id={id('phone')} type="tel" value={form.phone} onChange={set('phone')} placeholder="+254 712 345 678" />
        </div>
        <div className="field">
          <label htmlFor={id('phone_alt')}>Second phone</label>
          <input id={id('phone_alt')} type="tel" value={form.phone_alt} onChange={set('phone_alt')} />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor={id('relationship')}>Relationship to the child</label>
          <select id={id('relationship')} value={form.relationship} onChange={set('relationship')}>
            <option value="">Not given</option>
            {Object.entries(RELATIONSHIPS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor={id('preferred_contact')}>Best way to reach them</label>
          <select id={id('preferred_contact')} value={form.preferred_contact} onChange={set('preferred_contact')}>
            <option value="">No preference</option>
            {Object.entries(CONTACT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor={id('occupation')}>Occupation</label>
        <input id={id('occupation')} value={form.occupation} onChange={set('occupation')} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor={id('address')}>Home address</label>
        <textarea id={id('address')} rows={2} value={form.address} onChange={set('address')} />
      </div>
      {withNote && (
        <div className="field">
          <label htmlFor={id('admin_note')}>Admin note (only admins see this)</label>
          <textarea id={id('admin_note')} rows={2} value={form.admin_note} onChange={set('admin_note')} />
        </div>
      )}
      <div className="form-actions">
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save contact details'}</button>
        {onCancel && <button type="button" className="secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}

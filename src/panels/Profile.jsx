import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useSchool } from '../levels.js'
import { ContactForm } from './ParentContact.jsx'
import { NotificationsBlocked, currentSubscription, pushRegistration, turnOff, turnOn } from '../push.js'

// The person's own account, in Settings: who they are, how to reach them, what they're told about, and their password.
const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof', 'Rev']
const fieldError = (err) => Object.values(err?.data || {}).flat().find((v) => typeof v === 'string') || err?.message || 'Something went wrong.'

export default function AccountSettings({ me, identityKind, onUserUpdated }) {
  const isGuardian = identityKind === 'guardian'
  const save = (body) => (isGuardian ? api.updateGuardianMe(body) : api.updateMe(body))
    .then((updated) => { onUserUpdated?.({ ...me, ...updated }); return updated })
  return (
    <>
      <PersonalInfo me={me} isGuardian={isGuardian} save={save} />
      {isGuardian ? (me?.contact && <GuardianContact me={me} save={save} />) : <StaffContact me={me} save={save} />}
      <Notifications me={me} isGuardian={isGuardian} save={save} />
      <Security />
    </>
  )
}

function Section({ title, hint, children }) {
  return (
    <div className="card settings-card">
      <h3>{title}</h3>
      {hint && <p className="hint" style={{ marginTop: 0 }}>{hint}</p>}
      {children}
    </div>
  )
}

function useSaver(save) {
  const [state, setState] = useState({ saving: false, error: '', success: '' })
  async function run(body, success) {
    setState({ saving: true, error: '', success: '' })
    try {
      await save(body)
      setState({ saving: false, error: '', success })
      return true
    } catch (err) {
      setState({ saving: false, error: fieldError(err), success: '' })
      return false
    }
  }
  const banners = (
    <>
      {state.error && <div className="error-banner" role="alert">{state.error}</div>}
      {state.success && <div className="success-banner" role="status">{state.success}</div>}
    </>
  )
  return { ...state, run, banners }
}

function PersonalInfo({ me, isGuardian, save }) {
  const [form, setForm] = useState({ title: me?.title || '', name: me?.name || '' })
  const saver = useSaver(save)
  useEffect(() => { setForm({ title: me?.title || '', name: me?.name || '' }) }, [me?.title, me?.name])
  function submit(e) {
    e.preventDefault()
    const name = form.name.trim()
    if (name.length < 2) return
    saver.run(isGuardian ? { name } : { name, title: form.title }, 'Saved.')
  }
  return (
    <Section title="Personal info">
      <form onSubmit={submit}>
        {saver.banners}
        <div className="form-row">
          {!isGuardian && (
            <div className="field" style={{ maxWidth: 140 }}>
              <label htmlFor="set-title">Title</label>
              <select id="set-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}>
                <option value="">None</option>
                {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label htmlFor="display-name">Name</label>
            <input id="display-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} minLength="2" maxLength="255" required />
          </div>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>How your name appears to {isGuardian ? 'the school' : 'colleagues, students and parents'}.</p>
        <div className="form-actions"><button type="submit" disabled={saver.saving}>{saver.saving ? 'Saving…' : 'Save'}</button></div>
      </form>
    </Section>
  )
}

function StaffContact({ me, save }) {
  const school = useSchool()
  const blank = () => ({
    phone: me?.phone || '', emergency_contact_name: me?.emergency_contact_name || '', emergency_contact_phone: me?.emergency_contact_phone || '',
  })
  const [form, setForm] = useState(blank)
  const saver = useSaver(save)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const example = school?.country?.phone_example || '+254 712 345 678'
  return (
    <Section title="Contact info" hint="Only your school's admins can see these, to reach you (or someone for you) when they need to. To change the email you sign in with, ask an admin.">
      <form onSubmit={(e) => { e.preventDefault(); saver.run(form, 'Your contact details have been saved.') }}>
        {saver.banners}
        <div className="field">
          <label htmlFor="set-phone">Phone</label>
          <input id="set-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder={example} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="set-ec-name">Emergency contact</label>
            <input id="set-ec-name" value={form.emergency_contact_name} onChange={set('emergency_contact_name')} maxLength={120} placeholder="Name" />
          </div>
          <div className="field">
            <label htmlFor="set-ec-phone">Emergency contact&apos;s phone</label>
            <input id="set-ec-phone" type="tel" value={form.emergency_contact_phone} onChange={set('emergency_contact_phone')} placeholder={example} />
          </div>
        </div>
        <div className="form-actions"><button type="submit" disabled={saver.saving}>{saver.saving ? 'Saving…' : 'Save contact info'}</button></div>
      </form>
    </Section>
  )
}

// Parents keep their own phone numbers and address up to date for the school.
function GuardianContact({ me, save }) {
  const saver = useSaver(save)
  return (
    <Section title="Contact info" hint="The school uses these to reach you about your children. Your children's teachers can see your phone numbers. To change the email you sign in with, ask the school.">
      {saver.banners}
      <ContactForm parent={me.contact} saving={saver.saving} onSave={(form) => saver.run(form, 'Your contact details have been saved.')} idPrefix="my-contact" />
      {me?.students?.length > 0 && (
        <div className="profile-readonly" style={{ marginTop: 16 }}>
          <span>Your children</span>
          <strong>{me.students.map((s) => `${s.first_name} ${s.last_name}`).join(', ')}</strong>
        </div>
      )}
    </Section>
  )
}

function Notifications({ me, isGuardian, save }) {
  const saver = useSaver(save)
  const on = isGuardian ? !!me?.contact?.email_notifications : me?.email_notifications !== false
  return (
    <Section title="Notifications">
      {saver.banners}
      <label className="checkbox-label">
        <input type="checkbox" checked={on} disabled={saver.saving}
          onChange={(e) => saver.run({ email_notifications: e.target.checked }, e.target.checked ? 'Emails turned on.' : 'Emails turned off.')} />
        {isGuardian
          ? 'Email me when the school publishes an announcement or a report for my children'
          : 'Email me when a parent reports an absence in my class or says they have paid fees'}
      </label>
      {!isGuardian && (
        <p className="hint" style={{ margin: '4px 0 0' }}>
          Urgent alerts, password emails and anything about a student&apos;s safety are always sent.
        </p>
      )}
      {isGuardian && <PushToggle />}
    </Section>
  )
}

function Security() {
  const [form, setForm] = useState({ current: '', next: '', again: '' })
  const [state, setState] = useState({ busy: false, error: '', success: '' })
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  async function act(fn, success) {
    setState({ busy: true, error: '', success: '' })
    try {
      await fn()
      setState({ busy: false, error: '', success })
      return true
    } catch (err) {
      setState({ busy: false, error: fieldError(err), success: '' })
      return false
    }
  }
  async function submit(e) {
    e.preventDefault()
    if (form.next !== form.again) { setState({ busy: false, error: "The new passwords don't match.", success: '' }); return }
    const ok = await act(() => api.changePassword({ current_password: form.current, new_password: form.next }),
      'Your password was changed. Any other phones or computers you were signed in on have been signed out.')
    if (ok) setForm({ current: '', next: '', again: '' })
  }
  return (
    <Section title="Password and security">
      {state.error && <div className="error-banner" role="alert">{state.error}</div>}
      {state.success && <div className="success-banner" role="status">{state.success}</div>}
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="set-current">Current password</label>
          <input id="set-current" type="password" value={form.current} onChange={set('current')} required autoComplete="current-password" />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="set-next">New password</label>
            <input id="set-next" type="password" value={form.next} onChange={set('next')} required minLength={10} autoComplete="new-password" />
          </div>
          <div className="field">
            <label htmlFor="set-again">New password again</label>
            <input id="set-again" type="password" value={form.again} onChange={set('again')} required minLength={10} autoComplete="new-password" />
          </div>
        </div>
        <p className="hint" style={{ marginTop: 0 }}>At least 10 characters. A few words with a number is easy to remember and hard to guess.</p>
        <div className="form-actions"><button type="submit" disabled={state.busy}>{state.busy ? 'Saving…' : 'Change password'}</button></div>
      </form>
      <div className="settings-divider" />
      <div className="support-row">
        <div>
          <strong style={{ fontSize: 14 }}>Signed in somewhere else?</strong>
          <p className="hint" style={{ margin: '2px 0 0' }}>Sign out of HouseMaster on every other phone and computer. You stay signed in here.</p>
        </div>
        <button type="button" className="secondary" style={{ width: 'auto' }} disabled={state.busy}
          onClick={() => act(() => api.signOutOtherDevices(), 'Signed out of every other phone and computer.')}>
          Sign out other devices
        </button>
      </div>
    </Section>
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

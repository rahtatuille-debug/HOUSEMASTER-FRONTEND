import { useState } from 'react'
import { api } from '../api.js'
import PrivacyNotice from './PrivacyNotice.jsx'

// Small line icons for the feature list (24px grid, drawn with currentColor).
const ICONS = {
  grades: <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />,
  register: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  reports: <><path d="M6 3h9l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
  parents: <><circle cx="8" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.5 1.3-4.6 3-5.3 1.7.7 3 2.8 3 5.3" /></>,
  shield: <><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></>,
}

const FEATURES = [
  ['grades', 'Grades and CBC levels', 'Marks, averages and performance charts for every student, class and year group.'],
  ['register', 'Daily registers', 'Attendance in a few taps, with the day\'s gaps on your home page.'],
  ['reports', 'Report cards', 'AI-assisted comments, approval by admins, and PDF report cards for parents.'],
  ['parents', 'Families kept informed', 'Announcements, messages, urgent alerts and emails to parents.'],
  ['shield', 'Private by design', 'Each school\'s data is kept separate, in line with Kenya\'s Data Protection Act.'],
]

const SYSTEMS = ['CBC', '8-4-4', 'British / Cambridge', 'IB', 'American']

function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

// Public sign-up for a new school. The person registering becomes its first
// admin and goes straight into the setup wizard.
export default function RegisterSchool({ onRegistered, onBack }) {
  const [form, setForm] = useState({ school_name: '', name: '', email: '', password: '', confirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [showNotice, setShowNotice] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  const mismatch = form.confirm && form.password !== form.confirm

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    try {
      await api.registerSchool({
        school_name: form.school_name.trim(), name: form.name.trim(), email: form.email.trim(),
        password: form.password, accept_privacy: agreed,
      })
      onRegistered()
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="register-page">
      <section className="register-hero">
        <div className="register-brand">HouseMaster</div>
        <h1>Run your whole school from one place.</h1>
        <p className="register-lead">
          Grades, attendance, reports and parent communication for your staff, with a clear view for every family.
        </p>

        <ul className="register-systems" aria-label="Education systems supported">
          {SYSTEMS.map((s) => <li key={s}>{s}</li>)}
        </ul>

        <ul className="register-features">
          {FEATURES.map(([icon, title, text]) => (
            <li key={title}>
              <span className="register-icon"><Icon name={icon} /></span>
              <span><strong>{title}</strong>{text}</span>
            </li>
          ))}
        </ul>

        <ol className="register-steps">
          <li><span>1</span>Register</li>
          <li><span>2</span>Set up your school</li>
          <li><span>3</span>Invite staff and parents</li>
        </ol>
      </section>

      <section className="register-panel">
        <form className="register-card" onSubmit={submit}>
          <p className="register-step-label">Step 1 of 2 · Create your account</p>
          <h2>Register your school</h2>
          <p className="text-muted register-intro">
            You'll be the school's first administrator. Setting up classes, subjects and terms comes next and takes
            about ten minutes.
          </p>
          {error && <div className="error-banner">{error}</div>}

          <fieldset>
            <legend>Your school</legend>
            <div className="field">
              <label htmlFor="reg-school">School name</label>
              <input id="reg-school" value={form.school_name} onChange={set('school_name')} required minLength={2}
                placeholder="e.g. Sunrise Academy" autoComplete="organization" autoFocus />
            </div>
          </fieldset>

          <fieldset>
            <legend>About you</legend>
            <div className="field">
              <label htmlFor="reg-name">Full name</label>
              <input id="reg-name" value={form.name} onChange={set('name')} required minLength={2} autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="reg-email">Email</label>
              <input id="reg-email" type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
              <p className="field-help">You'll sign in with this.</p>
            </div>
            <div className="register-two">
              <div className="field">
                <label htmlFor="reg-password">Password</label>
                <input id="reg-password" type="password" value={form.password} onChange={set('password')} required
                  minLength={8} autoComplete="new-password" />
              </div>
              <div className="field">
                <label htmlFor="reg-confirm">Confirm password</label>
                <input id="reg-confirm" type="password" value={form.confirm} onChange={set('confirm')} required
                  autoComplete="new-password" aria-invalid={mismatch || undefined} />
              </div>
            </div>
            <p className="field-help" style={{ marginTop: -6 }}>
              {mismatch ? <span className="field-error-text">The passwords don't match yet.</span> : 'At least 8 characters, not just numbers.'}
            </p>
          </fieldset>

          <div className="register-consent">
            <label className="checkbox-label">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required />
              <span>
                I agree to how my data is used, as set out in the{' '}
                <button type="button" className="inline-link" aria-expanded={showNotice} onClick={() => setShowNotice(!showNotice)}>
                  privacy notice
                </button>.
              </span>
            </label>
            {showNotice && <PrivacyNotice schoolName={form.school_name.trim()} audience="staff" />}
          </div>

          <button type="submit" className="register-submit" disabled={submitting || !agreed || mismatch}>
            {submitting ? 'Creating your school…' : 'Create account and set up school'}
          </button>
          <p className="register-signin">
            Already using HouseMaster?{' '}
            <button type="button" className="inline-link" onClick={onBack}>Sign in</button>
          </p>
        </form>
      </section>
    </div>
  )
}

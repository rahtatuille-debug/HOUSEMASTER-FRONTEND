import { useEffect, useRef, useState } from 'react'
import PrivacyNotice, { PrivacyConsent } from './PrivacyNotice.jsx'
import { api } from '../api.js'
import { LogoFull } from './Logo.jsx'

const RELATIONSHIPS = [
  ['mother', 'Mother'], ['father', 'Father'], ['guardian', 'Guardian'], ['grandparent', 'Grandparent'],
  ['sibling', 'Sibling'], ['other', 'Other relative'],
]

// The page a school's admissions link opens: a family applies for a place,
// without an account. The school's admissions team takes it from there.
export default function Apply({ token, onSignIn }) {
  const [info, setInfo] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState({
    first_name: '', last_name: '', date_of_birth: '', gender: '', year_group: '', start: '', current_school: '',
    mode_of_learning: 'day', medical_notes: '', notes: '', parent_name: '', parent_email: '', parent_phone: '',
    relationship: '', website: '',
  })
  const [agreed, setAgreed] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // Set synchronously, so a double click or Enter pressed twice can't send the form twice before React re-renders.
  const sending = useRef(false)

  useEffect(() => { api.applyInfo(token).then(setInfo).catch((err) => setLoadError(err.message)) }, [token])
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    if (sending.current) return
    sending.current = true
    setError('')
    setSubmitting(true)
    try {
      const body = { ...form, consent: agreed, year_group: form.year_group ? Number(form.year_group) : null }
      await api.submitApplication(token, body)
      setSent(form.parent_email)
    } catch (err) {
      setError(err.message)
    } finally {
      sending.current = false
      setSubmitting(false)
    }
  }

  const field = (id, label, input, hint) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {input}
      {hint && <p className="hint" style={{ margin: '4px 0 0' }}>{hint}</p>}
    </div>
  )

  return (
    <div className="login-wrap">
      <div className="login-card" style={{ maxWidth: 560 }}>
        <LogoFull />
        <p className="tagline">Apply for a place</p>
        {loadError && <div className="error-banner">{loadError}</div>}

        {sent && (
          <div className="success-banner" role="status">
            Thank you. Check your email: we have sent a link to {sent}. Open it to confirm your address and send
            the application to {info?.school.name}. The link works once and only for a limited time, so please open it soon.
          </div>
        )}

        {info && !sent && (
          <>
            <h2 style={{ margin: '0 0 4px' }}>{info.school.name}</h2>
            {info.intro && <p className="hint" style={{ marginTop: 0, whiteSpace: 'pre-line' }}>{info.intro}</p>}
            {error && <div className="error-banner" role="alert">{error}</div>}
            <form onSubmit={submit}>
              <h3 style={{ fontSize: 15 }}>The child</h3>
              {field('ap-first', 'First name', <input id="ap-first" value={form.first_name} onChange={set('first_name')} required />)}
              {field('ap-last', 'Last name', <input id="ap-last" value={form.last_name} onChange={set('last_name')} required />)}
              {field('ap-dob', 'Date of birth', <input id="ap-dob" type="date" value={form.date_of_birth} onChange={set('date_of_birth')} required />)}
              {field('ap-gender', 'Gender', (
                <select id="ap-gender" value={form.gender} onChange={set('gender')}>
                  <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              ))}
              {info.year_groups.length > 0 && field('ap-year', 'Applying for', (
                <select id="ap-year" value={form.year_group} onChange={set('year_group')} required>
                  <option value="">Choose…</option>
                  {info.year_groups.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              ))}
              {field('ap-start', 'When would they start?', <input id="ap-start" value={form.start} onChange={set('start')} placeholder="e.g. January 2027" />)}
              {field('ap-current', 'Current school', <input id="ap-current" value={form.current_school} onChange={set('current_school')} />)}
              {info.school.has_boarding && field('ap-mode', 'Day or boarding', (
                <select id="ap-mode" value={form.mode_of_learning} onChange={set('mode_of_learning')}>
                  <option value="day">Day</option><option value="boarding">Boarding</option>
                </select>
              ))}
              {field('ap-medical', 'Health or learning needs the school should know about', <textarea id="ap-medical" rows={2} value={form.medical_notes} onChange={set('medical_notes')} />)}

              <h3 style={{ fontSize: 15 }}>You</h3>
              {field('ap-parent', 'Your full name', <input id="ap-parent" value={form.parent_name} onChange={set('parent_name')} required autoComplete="name" />)}
              {field('ap-email', 'Email', <input id="ap-email" type="email" value={form.parent_email} onChange={set('parent_email')} required autoComplete="email" />)}
              {field('ap-phone', 'Phone', <input id="ap-phone" type="tel" value={form.parent_phone} onChange={set('parent_phone')} required autoComplete="tel" placeholder={info.school.country?.phone_example} />)}
              {field('ap-rel', 'You are the child’s', (
                <select id="ap-rel" value={form.relationship} onChange={set('relationship')}>
                  <option value="">Choose…</option>
                  {RELATIONSHIPS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              ))}
              {field('ap-notes', 'Anything else you’d like the school to know', <textarea id="ap-notes" rows={3} value={form.notes} onChange={set('notes')} />)}
              {/* Left empty by people; bots fill it in. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px' }}>
                <label htmlFor="ap-website">Website</label>
                <input id="ap-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
              </div>
              <PrivacyNotice schoolName={info.school.name} contact={info.school.privacy_contact} country={info.school.country} audience="parent" />
              <PrivacyConsent checked={agreed} onChange={setAgreed} />
              <button type="submit" disabled={submitting || !agreed} style={{ width: '100%' }}>
                {submitting ? 'Sending…' : 'Send application'}
              </button>
            </form>
          </>
        )}
        <p className="hint" style={{ textAlign: 'center', marginTop: 16 }}>
          Already a parent at the school?{' '}
          <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={onSignIn}>Sign in</button>
        </p>
      </div>
    </div>
  )
}

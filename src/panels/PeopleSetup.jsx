import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'
import ImportCard from './ImportCard.jsx'
import StaffImportCard from './StaffImportCard.jsx'
import { ClassSignupLinks } from './ClassSignupCard.jsx'

// The last part of setup, after the school's structure: bring in the people.
export const PEOPLE_STEPS = ['Staff', 'Students', 'Parents', 'Open the school']
const STRUCTURE_STEPS = 8 // the steps of SetupWizard before these
const KEYS = ['staff', 'students', 'parents']

// Invite one person without a spreadsheet.
function QuickStaffInvite({ onDone }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.invites.create({ name: form.name.trim(), email: form.email.trim(), role: form.role })
      setNotice(`Invited ${form.name.trim()}. Give them their classes on the Staff page once they've joined.`)
      setForm({ name: '', email: '', role: form.role })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Or invite people one at a time</h3>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <form onSubmit={submit} className="form-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ps-name">Full name</label>
          <input id="ps-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={2} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ps-email">Email</label>
          <input id="ps-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div className="field" style={{ marginBottom: 0, maxWidth: 140 }}>
          <label htmlFor="ps-role">Role</label>
          <select id="ps-role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="teacher">Teacher</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Inviting…' : 'Invite'}</button>
      </form>
    </div>
  )
}

// Add one student without a spreadsheet.
function QuickStudentAdd({ onDone }) {
  const words = useVocab()
  const [classes, setClasses] = useState([])
  const empty = { first_name: '', last_name: '', external_id: '', school_class: '' }
  const [form, setForm] = useState(empty)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => { api.schoolClasses.list().then(setClasses).catch((err) => setError(err.message)) }, [])
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await api.students.create({ ...form, school_class: Number(form.school_class) })
      setNotice(`Added ${form.first_name.trim()} ${form.last_name.trim()}.`)
      setForm({ ...empty, school_class: form.school_class })
      onDone()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Or add students one at a time</h3>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      <form onSubmit={submit} className="form-row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ps-first">First name</label>
          <input id="ps-first" value={form.first_name} onChange={set('first_name')} required />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="ps-last">Last name</label>
          <input id="ps-last" value={form.last_name} onChange={set('last_name')} required />
        </div>
        <div className="field" style={{ marginBottom: 0, maxWidth: 160 }}>
          <label htmlFor="ps-adm">{words.student_id}</label>
          <input id="ps-adm" value={form.external_id} onChange={set('external_id')} />
        </div>
        <div className="field" style={{ marginBottom: 0, maxWidth: 180 }}>
          <label htmlFor="ps-class">{words.class}</label>
          <select id="ps-class" value={form.school_class} onChange={set('school_class')} required>
            <option value="">Choose…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy} style={{ width: 'auto' }}>{busy ? 'Adding…' : 'Add'}</button>
      </form>
      <p className="hint">Parents will need each child&apos;s {words.student_id.toLowerCase()} to sign up, so add it if you can.</p>
    </div>
  )
}

function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

// Staff, students and parents: each is needed before the school opens.
// The admin can leave and come back; the first unfinished step is shown.
export default function PeopleSetup({ me, onFinished, onLogout }) {
  const words = useVocab()
  const [status, setStatus] = useState(null)
  const [step, setStep] = useState(null)
  const [linksKey, setLinksKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const topRef = useRef(null)

  async function refresh() {
    try {
      const s = await api.setup.people()
      setStatus(s)
      setStep((current) => current ?? Math.max(0, KEYS.findIndex((k) => !s[k].done)) + (KEYS.every((k) => s[k].done) ? 3 : 0))
      return s
    } catch (err) {
      setError(err.message)
      return null
    }
  }

  useEffect(() => { refresh() }, [])

  if (!status || step === null) {
    return <div className="setup-wrap">{error ? <div className="error-banner">{error}</div> : <p className="text-muted">Loading…</p>}</div>
  }

  function go(next) {
    setError('')
    setStep(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function turnOnAll() {
    setBusy(true)
    setError('')
    try {
      await api.signupLinks.turnOnAll()
      setLinksKey((k) => k + 1)
      await refresh()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function open() {
    setBusy(true)
    setError('')
    try {
      await api.setup.complete()
      onFinished()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const key = KEYS[step]
  const done = key ? status[key].done : true
  const waiting = {
    staff: 'Invite at least one member of staff to continue.',
    students: 'Add at least one student to continue.',
    parents: 'Turn on a sign-up link for at least one class to continue.',
  }[key]
  const staffCount = status.staff.accounts + status.staff.invites

  return (
    <div className="setup-wrap" ref={topRef}>
      <div className="setup-header">
        <div>
          <p className="eyebrow">Set up {me?.school?.name || 'your school'}</p>
          <h2>{PEOPLE_STEPS[step]}</h2>
        </div>
        <button type="button" className="secondary" onClick={onLogout}>Save and sign out</button>
      </div>
      <ol className="setup-steps" aria-label="Setup steps">
        <li className="done"><span>✓</span> School, classes, subjects and terms</li>
        {PEOPLE_STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{STRUCTURE_STEPS + i + 1}</span> {label}
          </li>
        ))}
      </ol>

      <div className="card setup-card">
        {error && <div className="error-banner">{error}</div>}
        {step === 0 && (
          <>
            <p style={{ marginTop: 0 }}>
              Your {words.classes.toLowerCase()}, {words.subjects.toLowerCase()} and {words.terms.toLowerCase()} are
              ready. Now invite your teachers. The quickest way is the staff spreadsheet: download the template (it
              already lists your {words.classes.toLowerCase()} and {words.subjects.toLowerCase()}), add one row per
              person with what they teach, and upload it. Everyone gets an email invite, and their{' '}
              {words.classes.toLowerCase()} are set up when they accept.
            </p>
            <p className="setup-progress-line">
              {staffCount ? `✓ ${plural(staffCount, 'member')} of staff so far` : 'No staff yet'}
            </p>
          </>
        )}
        {step === 1 && (
          <>
            <p style={{ marginTop: 0 }}>
              Add your students. Download the template (its Classes sheet lists your {words.classes.toLowerCase()}),
              fill in one row per student with their {words.student_id.toLowerCase()} and{' '}
              {words.class.toLowerCase()}, and upload it. You&apos;ll see a preview before anything is saved, and you
              can import again later to add more.
            </p>
            <p className="setup-progress-line">
              {status.students.count ? `✓ ${plural(status.students.count, 'student')} so far` : 'No students yet'}
            </p>
          </>
        )}
        {step === 2 && (
          <>
            <p style={{ marginTop: 0 }}>
              Turn on a sign-up link for each {words.class.toLowerCase()} and share it with parents, for example in
              the {words.class.toLowerCase()}&apos;s WhatsApp group. Parents sign up with their child&apos;s{' '}
              {words.student_id.toLowerCase()}, and you approve each one on the Parents page; approving emails them
              their login. You can also invite parents one by one there later.
            </p>
            <p className="setup-progress-line">
              {status.parents.links
                ? `✓ Sign-up links on for ${status.parents.links} of ${plural(status.parents.classes, words.class.toLowerCase(), words.classes.toLowerCase())}`
                : 'No sign-up links yet'}
            </p>
            {status.parents.links < status.parents.classes && (
              <button type="button" onClick={turnOnAll} disabled={busy} style={{ width: 'auto' }}>
                {busy ? 'Turning on…' : `Turn on links for every ${words.class.toLowerCase()}`}
              </button>
            )}
          </>
        )}
        {step === 3 && (
          <>
            <p style={{ marginTop: 0 }}>Everything&apos;s in place:</p>
            <ul className="setup-summary">
              <li>✓ {plural(staffCount, 'member')} of staff invited or signed in</li>
              <li>✓ {plural(status.students.count, 'student')}</li>
              <li>✓ Parent sign-up links for {status.parents.links} of {plural(status.parents.classes, words.class.toLowerCase(), words.classes.toLowerCase())}</li>
            </ul>
            <p className="hint">
              Your home page has a first-week checklist that walks you through what comes next: taking the first
              register, entering marks and approving parents as they sign up.
            </p>
          </>
        )}

        <div className="form-actions setup-actions">
          {step > 0 && <button type="button" className="secondary" onClick={() => go(step - 1)} disabled={busy}>Back</button>}
          {step < 3 ? (
            <button type="button" onClick={() => go(step + 1)} disabled={!done}>Continue</button>
          ) : (
            <button type="button" onClick={open} disabled={busy}>{busy ? 'Opening…' : 'Open HouseMaster'}</button>
          )}
        </div>
        {!done && <p className="hint" style={{ textAlign: 'right', margin: '6px 0 0' }}>{waiting}</p>}
      </div>

      {step === 0 && (
        <>
          <StaffImportCard onImported={refresh} />
          <QuickStaffInvite onDone={refresh} />
        </>
      )}
      {step === 1 && (
        <>
          <ImportCard onImported={refresh} />
          <QuickStudentAdd onDone={refresh} />
        </>
      )}
      {step === 2 && <ClassSignupLinks refreshKey={linksKey} onChanged={refresh} />}

      <p className="text-muted setup-foot">Signed in as {me?.name} · You can sign out and pick up where you left off.</p>
    </div>
  )
}

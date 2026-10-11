import AccountSettings from './Profile.jsx'
import StudentProfile from './StudentPassword.jsx'
import PrivacyNotice from './PrivacyNotice.jsx'
import { getRoleLabel } from '../user.js'

// Settings, opened from the profile picture: the person's own details, contact info, notifications and
// password, then the school's pages they look after, help, and signing out.
const HINTS = {
  setup: 'School details, classes, subjects and terms',
  billing: 'Your HouseMaster subscription and invoices',
  approvals: 'Changes you have asked an admin to make',
  guide: 'How to do everything, step by step',
}

function initials(name) {
  return (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

function Row({ title, hint, onClick }) {
  return (
    <li>
      <button type="button" className="settings-row" onClick={onClick}>
        <span>
          <strong>{title}</strong>
          {hint && <span className="settings-hint">{hint}</span>}
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </li>
  )
}

export default function Settings({ me, identityKind, onUserUpdated, settingsPages = [], onNavigate, onStartTour, onLogout }) {
  const isStudent = identityKind === 'student'
  const who = identityKind === 'guardian' ? 'Parent' : isStudent ? `Student${me?.class_name ? ` · ${me.class_name}` : ''}` : getRoleLabel(me?.role)
  const school = me?.school
  const schoolPages = settingsPages.filter((p) => p.key !== 'guide')
  const hasGuide = settingsPages.some((p) => p.key === 'guide')
  const name = [me?.title, me?.name].filter(Boolean).join(' ')
  return (
    <section className="settings-page">
      <div className="panel-header"><h2>Settings</h2></div>

      <div className="card settings-who">
        <span className="settings-avatar" aria-hidden="true">{initials(me?.name)}</span>
        <div>
          <strong>{name || '—'}</strong>
          <span className="settings-hint">{who}{school?.name ? ` · ${school.name}` : ''}</span>
          {isStudent && me?.username && <span className="settings-hint">Username: {me.username}</span>}
        </div>
      </div>

      {isStudent
        ? <StudentProfile me={me} embedded />
        : <AccountSettings me={me} identityKind={identityKind} onUserUpdated={onUserUpdated} />}

      {schoolPages.length > 0 && (
        <>
          <h3 className="settings-group">{identityKind === 'staff' && me?.role === 'admin' ? 'Your school' : 'More'}</h3>
          <ul className="card settings-list">
            {schoolPages.map((p) => <Row key={p.key} title={p.label} hint={HINTS[p.key]} onClick={() => onNavigate(p.key)} />)}
          </ul>
        </>
      )}

      {(hasGuide || !isStudent) && <h3 className="settings-group">Help and privacy</h3>}
      {(hasGuide || !isStudent) && <ul className="card settings-list">
        {hasGuide && <Row title="Guide" hint={HINTS.guide} onClick={() => onNavigate('guide')} />}
        {hasGuide && onStartTour && <Row title="Take the tour" hint="A two-minute walk round HouseMaster" onClick={onStartTour} />}
        {!isStudent && <li>
          <details className="settings-details">
            <summary>
              <span>
                <strong>Privacy notice</strong>
                <span className="settings-hint">What {school?.name || 'the school'} keeps about you, and why</span>
              </span>
            </summary>
            <div className="settings-details-body">
              <PrivacyNotice schoolName={school?.name} contact={school?.privacy_contact} country={school?.country}
                audience={identityKind === 'guardian' ? 'parent' : 'staff'} />
            </div>
          </details>
        </li>}
      </ul>}

      {onLogout && <button type="button" className="danger" style={{ width: '100%', marginTop: 8 }} onClick={onLogout}>Log out</button>}
    </section>
  )
}

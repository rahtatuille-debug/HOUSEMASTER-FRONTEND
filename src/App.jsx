import { useEffect, useState } from 'react'
import { api } from './api.js'
import Login from './panels/Login.jsx'
import AcceptInvite from './panels/AcceptInvite.jsx'
import AcceptGuardianInvite from './panels/AcceptGuardianInvite.jsx'
import ForgotPassword from './panels/ForgotPassword.jsx'
import ResetPassword from './panels/ResetPassword.jsx'
import Students from './panels/Students.jsx'
import Setup from './panels/Setup.jsx'
import Grades from './panels/Grades.jsx'
import Reports from './panels/Reports.jsx'
import Staff from './panels/Staff.jsx'
import GuardianInvites from './panels/GuardianInvites.jsx'
import Announcements from './panels/Announcements.jsx'
import Messages from './panels/Messages.jsx'
import Profile from './panels/Profile.jsx'
import GuardianStudents from './panels/GuardianStudents.jsx'
import GuardianAnnouncements from './panels/GuardianAnnouncements.jsx'
import { personIdentity, guardianIdentity } from './user.js'

const TABS = [
  { key: 'students', label: 'Students', component: Students },
  { key: 'grades', label: 'Grades', component: Grades },
  { key: 'reports', label: 'Reports', component: Reports },
  { key: 'announcements', label: 'Communications', component: Announcements },
  { key: 'messages', label: 'Messages', component: Messages },
  { key: 'setup', label: 'Setup', component: Setup },
  { key: 'staff', label: 'Staff', component: Staff, adminOnly: true },
  { key: 'parents', label: 'Parents', component: GuardianInvites, adminOnly: true },
  { key: 'profile', label: 'Profile', component: Profile },
]

const GUARDIAN_TABS = [
  { key: 'students', label: 'Students', component: GuardianStudents },
  { key: 'announcements', label: 'Communications', component: GuardianAnnouncements },
  { key: 'messages', label: 'Messages', component: Messages },
  { key: 'profile', label: 'Profile', component: Profile },
]

// No router library — this app is small enough that a plain path check
// for the public routes (/invite/:token, /guardian-invite/:token,
// /reset-password/:token) plus tab state for everything else is simpler
// than pulling in react-router.
function getInviteToken() {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/)
  return match ? match[1] : null
}

function getGuardianInviteToken() {
  const match = window.location.pathname.match(/^\/guardian-invite\/([^/]+)\/?$/)
  return match ? match[1] : null
}

function getResetToken() {
  const match = window.location.pathname.match(/^\/reset-password\/([^/]+)\/?$/)
  return match ? match[1] : null
}

export default function App() {
  const [inviteToken, setInviteToken] = useState(getInviteToken())
  const [guardianInviteToken, setGuardianInviteToken] = useState(getGuardianInviteToken())
  const [resetToken, setResetToken] = useState(getResetToken())
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn())
  const [me, setMe] = useState(null)
  // 'staff' | 'guardian' | null (unknown until /api/me/ or /api/guardian-me/ resolves)
  const [identityKind, setIdentityKind] = useState(null)
  const [activeTab, setActiveTab] = useState('students')
  const [menuOpen, setMenuOpen] = useState(false)
  // Which screen to show when logged out and not on a token route.
  const [authView, setAuthView] = useState('login') // 'login' | 'forgot'
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    if (!loggedIn) return
    // A logged-in account is either staff (has a Profile, /api/me/ works)
    // or a guardian (has no Profile, /api/me/ 403s — try /api/guardian-me/
    // instead). Whichever succeeds first tells us which shell to render.
    api
      .me()
      .then((data) => {
        setMe(data)
        setIdentityKind('staff')
      })
      .catch((err) => {
        if (err.status === 403) {
          api
            .guardianMe()
            .then((data) => {
              setMe(data)
              setIdentityKind('guardian')
            })
            .catch(() => setLoggedIn(false))
        } else {
          // Any other failure (e.g. expired session) falls back to login.
          setLoggedIn(false)
        }
      })
  }, [loggedIn])

  useEffect(() => {
    if (!menuOpen) return
    function onKeyDown(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [menuOpen])

  function handleLogout() {
    api.logout()
    setMe(null)
    setIdentityKind(null)
    setLoggedIn(false)
    setMenuOpen(false)
  }

  function handleInviteAccepted() {
    window.history.replaceState({}, '', '/')
    setInviteToken(null)
    setLoggedIn(true)
  }

  function handleGuardianInviteAccepted() {
    window.history.replaceState({}, '', '/')
    setGuardianInviteToken(null)
    setLoggedIn(true)
  }

  function handlePasswordResetDone() {
    window.history.replaceState({}, '', '/')
    setResetToken(null)
    setAuthView('login')
    setAuthMessage('Your password has been reset. You can now sign in.')
  }

  if (inviteToken) {
    return <AcceptInvite token={inviteToken} onAccepted={handleInviteAccepted} />
  }

  if (guardianInviteToken) {
    return <AcceptGuardianInvite token={guardianInviteToken} onAccepted={handleGuardianInviteAccepted} />
  }

  if (resetToken) {
    return <ResetPassword token={resetToken} onDone={handlePasswordResetDone} />
  }

  if (!loggedIn) {
    if (authView === 'forgot') {
      return <ForgotPassword onBack={() => setAuthView('login')} />
    }
    return (
      <Login
        onLoggedIn={() => setLoggedIn(true)}
        onForgotPassword={() => {
          setAuthMessage('')
          setAuthView('forgot')
        }}
        successMessage={authMessage}
      />
    )
  }

  // Still resolving which identity type this account is.
  if (!identityKind) {
    return null
  }

  const tabSet = identityKind === 'guardian' ? GUARDIAN_TABS : TABS
  const visibleTabs = tabSet.filter((t) => !t.adminOnly || me?.role === 'admin')
  const activeKey = visibleTabs.some((t) => t.key === activeTab) ? activeTab : visibleTabs[0]?.key
  const ActivePanel = visibleTabs.find((t) => t.key === activeKey)?.component

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="menu-toggle"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <div className="brand">
            HouseMaster
            {me?.school && <span className="school-name">{me.school.name}</span>}
          </div>
        </div>
        <div className="topbar-right">
          {me && <span>{identityKind === 'guardian' ? guardianIdentity(me) : personIdentity(me)}</span>}
          <button className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={activeKey === t.key ? 'active' : ''}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {menuOpen && (
        <div className="nav-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      )}

      <nav className={`nav-drawer${menuOpen ? ' open' : ''}`} aria-label="Main navigation">
        <div className="nav-drawer-header">
          <span>Menu</span>
          <button
            type="button"
            className="secondary nav-drawer-close"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          >
            ✕
          </button>
        </div>
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={activeKey === t.key ? 'active' : ''}
            onClick={() => {
              setActiveTab(t.key)
              setMenuOpen(false)
            }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {ActivePanel && <ActivePanel me={me} identityKind={identityKind} onUserUpdated={setMe} />}
      </main>
    </div>
  )
}

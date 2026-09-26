import { useEffect, useRef, useState } from 'react'
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
import Attendance from './panels/Attendance.jsx'
import Approvals from './panels/Approvals.jsx'
import Activity from './panels/Activity.jsx'
import GuardianStudents from './panels/GuardianStudents.jsx'
import GuardianAnnouncements from './panels/GuardianAnnouncements.jsx'
import { personIdentity, guardianIdentity } from './user.js'

const TABS = [
  { key: 'students', label: 'Students', component: Students },
  { key: 'attendance', label: 'Attendance', component: Attendance },
  { key: 'grades', label: 'Grades', component: Grades },
  { key: 'reports', label: 'Reports', component: Reports },
  { key: 'announcements', label: 'Communications', component: Announcements },
  { key: 'messages', label: 'Messages', component: Messages },
  { key: 'approvals', label: 'Approvals', teacherLabel: 'My requests', component: Approvals },
  { key: 'setup', label: 'Setup', component: Setup },
  { key: 'staff', label: 'Staff', component: Staff, adminOnly: true },
  { key: 'parents', label: 'Parents', component: GuardianInvites, adminOnly: true },
  { key: 'activity', label: 'Activity log', component: Activity, adminOnly: true },
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

function BellIcon() {
  return (
    <svg viewBox="0 0 20 20" width="19" height="19" fill="none" aria-hidden="true">
      <path
        d="M10 2.5c-2.2 0-4 1.8-4 4v2.3c0 .5-.2 1-.5 1.4l-1 1.3c-.6.8 0 2 1 2h9c1 0 1.6-1.2 1-2l-1-1.3c-.3-.4-.5-.9-.5-1.4V6.5c0-2.2-1.8-4-4-4z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.2 15.5a1.8 1.8 0 0 0 3.6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

function GearIcon() {
  return (
    <svg viewBox="0 0 20 20" width="19" height="19" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2.7v1.8M10 15.5v1.8M17.3 10h-1.8M4.5 10H2.7M15.1 4.9l-1.3 1.3M6.2 13.8l-1.3 1.3M15.1 15.1l-1.3-1.3M6.2 6.2 4.9 4.9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" width="19" height="19" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="3.2" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3.8 16.3c1-2.8 3.5-4.5 6.2-4.5s5.2 1.7 6.2 4.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  )
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
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // Which screen to show when logged out and not on a token route.
  const [authView, setAuthView] = useState('login') // 'login' | 'forgot'
  const [authMessage, setAuthMessage] = useState('')

  // Admins: teachers' requests plus reports waiting to be finalized.
  const [waitingCount, setWaitingCount] = useState(0)

  const notifRef = useRef(null)
  const profileRef = useRef(null)

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

  function refreshWaitingCount() {
    if (identityKind !== 'staff' || me?.role !== 'admin') {
      setWaitingCount(0)
      return
    }
    Promise.all([api.changeRequests.list({ status: 'pending' }), api.reports.list({ status: 'submitted' })])
      .then(([requests, reports]) => setWaitingCount(requests.length + reports.length))
      .catch(() => {})
  }

  useEffect(() => {
    refreshWaitingCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKind, me?.role, activeTab])

  // Shared close-on-Escape / close-on-outside-click handling for the three
  // overlay affordances (mobile sidebar, notifications popover, profile menu).
  useEffect(() => {
    if (!menuOpen && !notifOpen && !profileOpen) return
    function onKeyDown(e) {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      setNotifOpen(false)
      setProfileOpen(false)
    }
    function onClickOutside(e) {
      if (notifOpen && notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
      if (profileOpen && profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mousedown', onClickOutside)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mousedown', onClickOutside)
    }
  }, [menuOpen, notifOpen, profileOpen])

  function handleLogout() {
    api.logout()
    setMe(null)
    setIdentityKind(null)
    setLoggedIn(false)
    setMenuOpen(false)
    setProfileOpen(false)
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
  const identityLine = identityKind === 'guardian' ? guardianIdentity(me) : personIdentity(me)
  // Settings has nowhere sensible to send a guardian yet (no Setup-equivalent
  // for them), so it's staff-only — same gate as the Setup tab itself.
  const showSettings = identityKind === 'staff'

  function selectTab(key) {
    setActiveTab(key)
    setMenuOpen(false)
  }

  const sidebarContent = (
    <>
      <div className="sidebar-brand">
        HouseMaster
        {me?.school && <span className="school-name">{me.school.name}</span>}
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        {visibleTabs.map((t) => (
          <button key={t.key} className={activeKey === t.key ? 'active' : ''} onClick={() => selectTab(t.key)}>
            {me?.role !== 'admin' && t.teacherLabel ? t.teacherLabel : t.label}
            {t.key === 'approvals' && waitingCount > 0 && (
              <span className="nav-count" aria-label={`${waitingCount} waiting`}>
                {waitingCount}
              </span>
            )}
          </button>
        ))}
      </nav>
    </>
  )

  return (
    <div className="app-shell">
      {menuOpen && <div className="nav-backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-mobile-header">
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
        {sidebarContent}
      </aside>

      <div className="main-column">
        <header className="topbar">
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

          <div className="topbar-spacer" />

          <div className="topbar-icons">
            <div className="icon-menu-wrap" ref={notifRef}>
              <button
                type="button"
                className="icon-button"
                aria-label="Notifications"
                aria-expanded={notifOpen}
                onClick={() => {
                  setNotifOpen((open) => !open)
                  setProfileOpen(false)
                }}
              >
                <BellIcon />
              </button>
              {notifOpen && (
                <div className="icon-popover">
                  {waitingCount > 0 ? (
                    <button
                      type="button"
                      className="link-button"
                      style={{ padding: 0, textAlign: 'left' }}
                      onClick={() => {
                        selectTab('approvals')
                        setNotifOpen(false)
                      }}
                    >
                      {waitingCount} item{waitingCount === 1 ? '' : 's'} waiting for your approval
                    </button>
                  ) : (
                    <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
                      No new notifications yet.
                    </p>
                  )}
                </div>
              )}
            </div>

            {showSettings && (
              <button
                type="button"
                className="icon-button"
                aria-label="Settings"
                onClick={() => selectTab('setup')}
              >
                <GearIcon />
              </button>
            )}

            <div className="icon-menu-wrap" ref={profileRef}>
              <button
                type="button"
                className="icon-button avatar-button"
                aria-label="Your profile"
                aria-expanded={profileOpen}
                onClick={() => {
                  setProfileOpen((open) => !open)
                  setNotifOpen(false)
                }}
              >
                <UserIcon />
              </button>
              {profileOpen && (
                <div className="icon-popover profile-popover">
                  <p style={{ margin: '0 0 10px', fontSize: 14, fontWeight: 600 }}>{identityLine}</p>
                  <button
                    type="button"
                    className="secondary"
                    style={{ width: '100%', marginBottom: 8 }}
                    onClick={() => {
                      selectTab('profile')
                      setProfileOpen(false)
                    }}
                  >
                    View profile
                  </button>
                  <button type="button" className="danger" style={{ width: '100%' }} onClick={handleLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          {ActivePanel && (
            <ActivePanel
              me={me}
              identityKind={identityKind}
              onUserUpdated={setMe}
              onCountsChanged={refreshWaitingCount}
            />
          )}
        </main>
      </div>
    </div>
  )
}

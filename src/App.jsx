import { useEffect, useRef, useState } from 'react'
import { formatDateTime, setDateLocale } from './format.js'
import RegisterSchool from './panels/RegisterSchool.jsx'
import SetupWizard from './panels/SetupWizard.jsx'
import PeopleSetup from './panels/PeopleSetup.jsx'
import { SchoolContext, vocabFor } from './levels.js'
import { guideSections } from './guide.js'
import Guide from './panels/Guide.jsx'
import TeacherHome from './panels/TeacherHome.jsx'
import Tour from './panels/Tour.jsx'
import { api, countOf } from './api.js'
import { connection } from './connection.js'
import { LogoFull } from './panels/Logo.jsx'
import Login from './panels/Login.jsx'
import AcceptInvite from './panels/AcceptInvite.jsx'
import AcceptGuardianInvite from './panels/AcceptGuardianInvite.jsx'
import JoinClass from './panels/JoinClass.jsx'
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
import Alerts from './panels/Alerts.jsx'
import Home from './panels/Home.jsx'
import Exports from './panels/Exports.jsx'
import Performance from './panels/Performance.jsx'
import Support from './panels/Support.jsx'
import GuardianStudents from './panels/GuardianStudents.jsx'
import GuardianAnnouncements from './panels/GuardianAnnouncements.jsx'
import { personIdentity, guardianIdentity } from './user.js'

const TABS = [
  { key: 'home', label: 'Home', component: StaffHome },
  { key: 'students', label: 'Students', component: Students },
  { key: 'attendance', label: 'Attendance', component: Attendance },
  { key: 'grades', label: 'Grades', component: Grades },
  { key: 'reports', label: 'Reports', component: Reports },
  { key: 'performance', label: 'Performance', component: Performance },
  { key: 'support', label: 'Needs support', component: Support },
  { key: 'announcements', label: 'Communications', component: Announcements },
  { key: 'messages', label: 'Messages', component: Messages },
  { key: 'alerts', label: 'Urgent alerts', component: Alerts },
  { key: 'exports', label: 'Exports', component: Exports },
  { key: 'approvals', label: 'Approvals', teacherLabel: 'My requests', component: Approvals },
  { key: 'setup', label: 'Setup', component: Setup },
  { key: 'staff', label: 'Staff', component: Staff, adminOnly: true },
  { key: 'parents', label: 'Parents', component: GuardianInvites, adminOnly: true },
  { key: 'activity', label: 'Activity log', component: Activity, adminOnly: true },
  { key: 'guide', label: 'Guide', component: Guide },
  { key: 'profile', label: 'Profile', component: Profile },
]

// Admins get the school's dashboard; teachers get their classes and a getting-started checklist.
function StaffHome(props) {
  return props.me?.role === 'admin' ? <Home {...props} /> : <TeacherHome {...props} />
}

// The guided tour: a welcome, one stop per menu item, and where to find help afterwards.
function tourSteps(me, tabKeys) {
  const role = me?.role === 'admin' ? 'admin' : 'teacher'
  const sections = guideSections(vocabFor(me?.school), role).filter((s) => tabKeys.includes(s.key))
  const first = me?.name?.split(' ')[0]
  return [
    { key: 'welcome', title: `Welcome to HouseMaster${first ? `, ${first}` : ''}`,
      text: `A quick tour of everything you can do here, one menu item at a time. It takes about two minutes, and you can leave it whenever you like.` },
    ...sections.map((s) => ({ key: s.key, title: s.title, text: s.tour, menu: true })),
    { key: 'guide', title: 'Guide', menu: true,
      text: 'Step-by-step instructions for every page. Come back here any time you are unsure how to do something, or to take this tour again.' },
    { key: 'end', title: "You're ready",
      text: role === 'admin'
        ? 'Your Home page shows what needs you today and your school\'s first-week checklist.'
        : 'Your Home page has your classes and a getting-started checklist that ticks itself as you go. A good first step is today\'s register.' },
  ]
}

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

function getJoinToken() {
  const match = window.location.pathname.match(/^\/join\/([^/]+)\/?$/)
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
  const [joinToken, setJoinToken] = useState(getJoinToken())
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn())
  const [me, setMe] = useState(null)
  // 'staff' | 'guardian' | null (unknown until /api/me/ or /api/guardian-me/ resolves)
  const [identityKind, setIdentityKind] = useState(null)
  const [activeTab, setActiveTab] = useState('home')
  const [menuOpen, setMenuOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  // A teacher's first visit starts with the guided tour (once; it can be replayed from Home or the Guide).
  const autoTour = identityKind === 'staff' && me && me.role !== 'admin' && me.tour_seen === false && me.school?.setup_completed
  useEffect(() => { if (autoTour) setTourOpen(true) }, [autoTour])
  const [notifOpen, setNotifOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  // Which screen to show when logged out and not on a token route.
  const [authView, setAuthView] = useState(window.location.pathname.replace(/\/$/, '') === '/register' ? 'register' : 'login') // 'login' | 'forgot' | 'register'
  const [authMessage, setAuthMessage] = useState('')

  // Admins: teachers' requests plus reports waiting to be finalized.
  const [waitingCount, setWaitingCount] = useState(0)
  // Urgent alerts this person hasn't confirmed seeing yet (the red banner).
  const [urgentAlerts, setUrgentAlerts] = useState([])

  const notifRef = useRef(null)
  const profileRef = useRef(null)

  // Opening the app with no signal: the phone is still signed in, so wait for
  // a connection (and say so) rather than asking for the password again.
  const [identityOffline, setIdentityOffline] = useState(false)
  const [identityAttempt, setIdentityAttempt] = useState(0)

  useEffect(() => {
    if (!loggedIn) return
    setIdentityOffline(false)
    const failed = (err) => {
      // No signal, or the server itself down: wait. Anything else (an
      // expired session) goes back to sign-in.
      if (err?.network || err?.status >= 500) setIdentityOffline(true)
      else setLoggedIn(false)
    }
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
            .catch(failed)
        } else {
          failed(err)
        }
      })
  }, [loggedIn, identityAttempt])

  useEffect(() => {
    if (!identityOffline) return undefined
    const retry = () => setIdentityAttempt((n) => n + 1)
    const stop = connection.subscribe((s) => { if (s.reachable) retry() })
    window.addEventListener('online', retry)
    return () => {
      stop()
      window.removeEventListener('online', retry)
    }
  }, [identityOffline])

  function refreshWaitingCount() {
    if (identityKind !== 'staff' || me?.role !== 'admin') {
      setWaitingCount(0)
      return
    }
    // One-row pages: only the counts are needed (a whole list from an older backend works too).
    Promise.all([api.changeRequests.page({ status: 'pending', page_size: 1 }), api.reports.page({ status: 'submitted', page_size: 1 })])
      .then(([requests, reports]) => setWaitingCount(countOf(requests) + countOf(reports)))
      .catch(() => {})
  }

  useEffect(() => {
    refreshWaitingCount()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identityKind, me?.role, activeTab])

  // Check for urgent alerts on load and every minute after, for staff and parents.
  useEffect(() => {
    if (!identityKind) return
    let cancelled = false
    function check() {
      api.alerts
        .active()
        .then((list) => !cancelled && setUrgentAlerts(list))
        .catch(() => {})
    }
    check()
    const timer = setInterval(check, 60000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [identityKind])

  async function acknowledgeAlert(id) {
    try {
      await api.alerts.acknowledge(id)
      setUrgentAlerts((list) => list.filter((a) => a.id !== id))
    } catch {
      // Leave the banner up if it didn't save; they can tap again.
    }
  }

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

  if (joinToken) {
    return <JoinClass token={joinToken} onSignIn={() => { window.history.replaceState({}, '', '/'); setJoinToken(null) }} />
  }

  if (resetToken) {
    return <ResetPassword token={resetToken} onDone={handlePasswordResetDone} />
  }

  if (!loggedIn) {
    if (authView === 'forgot') {
      return <ForgotPassword onBack={() => setAuthView('login')} />
    }
    if (authView === 'register') {
      return (
        <RegisterSchool
          onRegistered={() => {
            window.history.replaceState({}, '', '/')
            setAuthView('login')
            setLoggedIn(true)
          }}
          onBack={() => {
            window.history.replaceState({}, '', '/')
            setAuthView('login')
          }}
        />
      )
    }
    return (
      <Login
        onLoggedIn={() => setLoggedIn(true)}
        onForgotPassword={() => {
          setAuthMessage('')
          setAuthView('forgot')
        }}
        onRegister={() => {
          setAuthMessage('')
          setAuthView('register')
        }}
        successMessage={authMessage}
      />
    )
  }

  // Dates follow the school's country (e.g. 27/09/2026 in Kenya, 9/27/2026 in the US).
  setDateLocale(me?.school?.country?.locale)

  // Still resolving which identity type this account is.
  if (!identityKind) {
    if (identityOffline) {
      return (
        <div className="login-wrap">
          <div className="login-card">
            <LogoFull />
            <p className="tagline">Waiting for a connection</p>
            <p>
              You’re still signed in, but your phone can’t reach HouseMaster right now. Check your
              signal: this page will load by itself when the connection is back.
            </p>
            <button type="button" onClick={() => setIdentityAttempt((n) => n + 1)}>Try again</button>
            <button type="button" className="link-button" onClick={handleLogout}>Sign out</button>
          </div>
        </div>
      )
    }
    return (
      <div className="login-wrap">
        <p className="loading-note" role="status">Loading HouseMaster…</p>
      </div>
    )
  }

  // A new school has to finish setup before anyone can use it.
  if (identityKind === 'staff' && me?.school && me.school.setup_completed === false) {
    if (me.role === 'admin' && me.school.setup_stage === 'people') {
      // Staff, students and parents, once the structure is in place. Words follow the chosen system.
      return (
        <SchoolContext.Provider value={me.school}>
          <PeopleSetup me={me} onLogout={handleLogout}
            onFinished={() => api.me().then(setMe).catch(() => setLoggedIn(false))} />
        </SchoolContext.Provider>
      )
    }
    if (me.role === 'admin') {
      return (
        <SetupWizard
          me={me}
          onLogout={handleLogout}
          onFinished={() => api.me().then(setMe).catch(() => setLoggedIn(false))}
        />
      )
    }
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>HouseMaster</h1>
          <p>{me.school.name} is still being set up. An administrator needs to finish setup before you can start.</p>
          <button type="button" className="secondary" onClick={handleLogout}>Sign out</button>
        </div>
      </div>
    )
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
          <button key={t.key} data-tab={t.key} className={activeKey === t.key ? 'active' : ''} onClick={() => selectTab(t.key)}>
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

  function closeTour() {
    setTourOpen(false)
    setMenuOpen(false)
    if (!me?.tour_seen) {
      // Saved first, so the home page's checklist ticks the tour off when it reloads.
      api.tourSeen().then(() => setMe((m) => (m ? { ...m, tour_seen: true } : m))).catch(() => {})
    }
  }

  return (
    <div className="app-shell">
      {tourOpen && identityKind === 'staff' && (
        <Tour steps={tourSteps(me, visibleTabs.map((t) => t.key))} onClose={closeTour}
          onShowMenu={(show) => { if (window.innerWidth <= 768) setMenuOpen(show) }} />
      )}
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

        {urgentAlerts.map((a) => (
          <div className="urgent-banner" role="alert" key={a.id}>
            <div>
              <span className="urgent-label">{a.is_test ? 'Test' : 'Urgent'}</span>
              <strong>{a.title}</strong>
              <p>{a.body}</p>
              <span className="urgent-meta">
                {a.created_by_name} · {formatDateTime(a.created_at)}
              </span>
            </div>
            <button type="button" onClick={() => acknowledgeAlert(a.id)}>
              I've seen this
            </button>
          </div>
        ))}

        <main className="content">
          <SchoolContext.Provider value={me?.school || null}>
            {ActivePanel && (
              <ActivePanel
                me={me}
                identityKind={identityKind}
                onUserUpdated={setMe}
                onCountsChanged={refreshWaitingCount}
                onNavigate={selectTab}
                onStartTour={() => setTourOpen(true)}
              />
            )}
          </SchoolContext.Provider>
        </main>
      </div>
    </div>
  )
}

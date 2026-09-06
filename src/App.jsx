import { useEffect, useState } from 'react'
import { api } from './api.js'
import Login from './panels/Login.jsx'
import AcceptInvite from './panels/AcceptInvite.jsx'
import ForgotPassword from './panels/ForgotPassword.jsx'
import ResetPassword from './panels/ResetPassword.jsx'
import Students from './panels/Students.jsx'
import Setup from './panels/Setup.jsx'
import Grades from './panels/Grades.jsx'
import Reports from './panels/Reports.jsx'
import Staff from './panels/Staff.jsx'

const TABS = [
  { key: 'students', label: 'Students', component: Students },
  { key: 'grades', label: 'Grades', component: Grades },
  { key: 'reports', label: 'Reports', component: Reports },
  { key: 'setup', label: 'Setup', component: Setup },
  { key: 'staff', label: 'Staff', component: Staff, adminOnly: true },
]

// No router library — this app is small enough that a plain path check
// for the public routes (/invite/:token, /reset-password/:token) plus tab
// state for everything else is simpler than pulling in react-router.
function getInviteToken() {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/)
  return match ? match[1] : null
}

function getResetToken() {
  const match = window.location.pathname.match(/^\/reset-password\/([^/]+)\/?$/)
  return match ? match[1] : null
}

export default function App() {
  const [inviteToken, setInviteToken] = useState(getInviteToken())
  const [resetToken, setResetToken] = useState(getResetToken())
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn())
  const [me, setMe] = useState(null)
  const [activeTab, setActiveTab] = useState('students')
  // Which screen to show when logged out and not on a token route.
  const [authView, setAuthView] = useState('login') // 'login' | 'forgot'
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    if (!loggedIn) return
    api
      .me()
      .then(setMe)
      .catch(() => {
        // If /me/ fails (e.g. expired session), fall back to the login screen.
        setLoggedIn(false)
      })
  }, [loggedIn])

  function handleLogout() {
    api.logout()
    setMe(null)
    setLoggedIn(false)
  }

  function handleInviteAccepted() {
    window.history.replaceState({}, '', '/')
    setInviteToken(null)
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

  const visibleTabs = TABS.filter((t) => !t.adminOnly || me?.role === 'admin')
  const ActivePanel = visibleTabs.find((t) => t.key === activeTab)?.component || Students

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          HouseMaster
          {me?.school && <span className="school-name">{me.school.name}</span>}
        </div>
        <div className="topbar-right">
          {me && <span>{me.email} · {me.role}</span>}
          <button className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <nav className="tabs">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            className={activeTab === t.key ? 'active' : ''}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        <ActivePanel />
      </main>
    </div>
  )
}

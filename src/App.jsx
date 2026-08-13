import { useEffect, useState } from 'react'
import { api } from './api.js'
import Login from './panels/Login.jsx'
import AcceptInvite from './panels/AcceptInvite.jsx'
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
// for the one public route (/invite/:token) plus tab state for everything
// else is simpler than pulling in react-router for a single case.
function getInviteToken() {
  const match = window.location.pathname.match(/^\/invite\/([^/]+)\/?$/)
  return match ? match[1] : null
}

export default function App() {
  const [inviteToken, setInviteToken] = useState(getInviteToken())
  const [loggedIn, setLoggedIn] = useState(api.isLoggedIn())
  const [me, setMe] = useState(null)
  const [activeTab, setActiveTab] = useState('students')

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

  if (inviteToken) {
    return <AcceptInvite token={inviteToken} onAccepted={handleInviteAccepted} />
  }

  if (!loggedIn) {
    return <Login onLoggedIn={() => setLoggedIn(true)} />
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
          {me && <span>{me.username} · {me.role}</span>}
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

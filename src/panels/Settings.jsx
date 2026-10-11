// Settings, opened from the profile picture: your profile, the school's setup, the guide and the tour.
const HINTS = {
  profile: 'Your name, password and notifications',
  setup: 'School details, classes, subjects and terms',
  approvals: 'Changes you have asked an admin to make',
  guide: 'How to do everything, step by step',
}

export default function Settings({ settingsPages = [], onNavigate, onStartTour, onLogout }) {
  const has = (key) => settingsPages.some((p) => p.key === key)
  return (
    <section>
      <div className="panel-header"><h2>Settings</h2></div>
      <ul className="card settings-list">
        {settingsPages.map((p) => (
          <li key={p.key}>
            <button type="button" className="settings-row" onClick={() => onNavigate(p.key)}>
              <span>
                <strong>{p.key === 'profile' ? 'View profile' : p.label}</strong>
                {HINTS[p.key] && <span className="settings-hint">{HINTS[p.key]}</span>}
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        ))}
        {has('guide') && onStartTour && (
          <li>
            <button type="button" className="settings-row" onClick={onStartTour}>
              <span>
                <strong>Take the tour</strong>
                <span className="settings-hint">A two-minute walk round HouseMaster</span>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </li>
        )}
      </ul>
      {onLogout && <button type="button" className="danger" style={{ width: '100%' }} onClick={onLogout}>Log out</button>}
    </section>
  )
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initSentry, ErrorBoundary } from './sentry.js'
import './styles.css'

initSentry()

// Shown instead of a blank white page if a render error escapes the app.
// The error is reported to Sentry (when configured) by the boundary itself.
function CrashFallback() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>Something went wrong</h1>
        <p className="tagline">
          HouseMaster hit an unexpected error. Reloading the page usually fixes it.
        </p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

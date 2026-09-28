import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CrashFallback from './CrashFallback.jsx'
import { initSentry, ErrorBoundary } from './sentry.js'
import './fonts.css'
import './styles.css'
import { startResponsiveTables } from './responsiveTables.js'

initSentry()
startResponsiveTables()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<CrashFallback />}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

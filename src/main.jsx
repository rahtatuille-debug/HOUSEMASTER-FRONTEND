import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import CrashFallback from './CrashFallback.jsx'
import OfflineBanner from './OfflineBanner.jsx'
import { registerServiceWorker } from './serviceWorker.js'
import { initSentry, ErrorBoundary } from './sentry.js'
import './fonts.css'
import './styles.css'
import { startResponsiveTables } from './responsiveTables.js'

initSentry()
startResponsiveTables()
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary fallback={<CrashFallback />}>
      <OfflineBanner />
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)

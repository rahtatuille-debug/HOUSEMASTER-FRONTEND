import * as Sentry from '@sentry/react'

// Error monitoring (Sentry). Mirrors the backend: only initializes if
// VITE_SENTRY_DSN is set at build time. Without it everything still works,
// errors just aren't reported anywhere. Set VITE_SENTRY_DSN in Vercel's
// project environment variables (it's baked in at build, so redeploy after).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

export function initSentry() {
  if (!SENTRY_DSN) return
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    // Don't attach IPs/cookies/request bodies — this app handles student
    // and guardian data.
    sendDefaultPii: false,
  })
}

// Report a failed API call. Only server errors (5xx) and network failures
// are worth an alert; 4xx responses are validation/permission errors the
// user already sees in the UI.
export function reportApiError(err, { method, path }) {
  if (!SENTRY_DSN) return
  if (err.status && err.status < 500) return
  Sentry.withScope((scope) => {
    scope.setTag('api.method', method)
    // Path only, no query string (may contain filters tied to a student).
    scope.setTag('api.path', path)
    if (err.status) scope.setTag('api.status', String(err.status))
    Sentry.captureException(err)
  })
}

export const ErrorBoundary = Sentry.ErrorBoundary

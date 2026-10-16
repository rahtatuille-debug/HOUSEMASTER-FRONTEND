import * as Sentry from '@sentry/react'

// Error monitoring (Sentry). Mirrors the backend: only initializes if
// VITE_SENTRY_DSN is set at build time. Without it everything still works,
// errors just aren't reported anywhere. Set VITE_SENTRY_DSN in Vercel's
// project environment variables (it's baked in at build, so redeploy after).
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || ''

// Sign-up, invite, admissions and password-reset links carry their secret in the address, and
// Sentry attaches the page address and every API call's address to each report. Scrub the secret
// segment (longer prefixes first: "apply/confirm" before "apply") and token-like query values.
const TOKEN_PATH = new RegExp(
  '(/(?:payments/hooks|mpesa/hooks|calendar/ical|staff-join|join|guardian-invites/preview|invites/preview' +
    '|guardian-invite|invite|admissions/apply|admissions/confirm|apply/confirm|apply|reset-password)/)' +
    '[^/?#\\s\'"<>]+',
  'gi',
)
const TOKEN_QUERY = /([?&](?:token|key|code|uid|secret|password|signature)=)[^&#\s'"<>]+/gi
const FILTERED = '[Filtered]'

export function scrubText(text) {
  return text.replace(TOKEN_PATH, `$1${FILTERED}`).replace(TOKEN_QUERY, `$1${FILTERED}`)
}

export function scrub(value) {
  if (typeof value === 'string') return scrubText(value)
  if (Array.isArray(value)) return value.map(scrub)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrub(v)]))
  }
  return value
}

export function initSentry() {
  if (!SENTRY_DSN) return
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
    // Don't attach IPs/cookies/request bodies — this app handles student
    // and guardian data.
    sendDefaultPii: false,
    beforeSend: (event) => scrub(event),
    beforeSendTransaction: (event) => scrub(event),
    beforeBreadcrumb: (crumb) => scrub(crumb),
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
    scope.setTag('api.path', scrubText(path))
    if (err.status) scope.setTag('api.status', String(err.status))
    Sentry.captureException(err)
  })
}

export const ErrorBoundary = Sentry.ErrorBoundary

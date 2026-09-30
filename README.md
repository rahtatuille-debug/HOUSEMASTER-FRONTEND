# HouseMaster Frontend

Teacher-facing UI for HouseMaster: login, student management, grade entry,
and the AI report generation/review workflow (draft → reviewed → finalized).

Built with React + Vite, plain CSS (no UI framework), talking to the Django
REST API via JWT auth.

## Local development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Expects the Django backend running at
`http://127.0.0.1:8001` by default — change `VITE_API_BASE_URL` in `.env` if
your backend runs elsewhere.

You'll need at least one staff account with a `Profile` (created via the
backend's `/admin/`) to log in — see the backend's handoff brief for that
setup.

## What's here

- `src/api.js` — all backend calls, JWT storage (localStorage), and
  automatic access-token refresh on expiry (retries the request once via
  `/api/token/refresh/` on a 401 before giving up).
- `src/App.jsx` — auth gate, top bar, tab navigation.
- `src/panels/Login.jsx` — sign-in screen.
- `src/panels/Students.jsx` — list/add/edit students, activate/deactivate.
- `src/panels/Setup.jsx` — manage Subjects and Terms (prerequisites for
  grades and reports). **Class management is intentionally not here** — the
  backend has no `YearGroup` API endpoint yet, only `/admin/`. See the
  project status doc for details.
- `src/panels/Grades.jsx` — record/edit/delete grades, filterable by student
  and term.
- `src/panels/Reports.jsx` — the core feature. Generate an AI report for a
  student+term, review/edit the generated text inline, and move it through
  draft → reviewed → finalized.

## Known limitations (carried over honestly, not hidden)

- No class ("7A", "Year 9 Blue") management UI — backend gap, see above.
- No signup/invite flow — accounts are still admin-panel-only on the backend.
- No pagination — the students/grades/reports lists fetch everything in one
  request. Fine at pilot-school scale, will need addressing before a school
  with hundreds of students.
- Offline is partial (see "Weak signal and offline" below): the app opens
  and says what's happening, but data isn't stored for reading offline and
  changes can't be queued to send later.

## Weak signal and offline

- **Installable app.** `vite.config.js` builds `dist/sw.js`, a service
  worker that keeps the page, the start-up scripts and styles, the icons,
  the logos and the body font on the phone, so the app opens with no signal.
  `public/manifest.webmanifest` and `public/icons/` let phones add it to the
  home screen. It never touches the API (another site) or anything but GET
  requests, so data always comes from the server.
- **Offline banner** (`src/OfflineBanner.jsx`): offline, weak signal, back
  online. While the server can't be reached it checks `/healthz` every 15
  seconds. Opening the app with no signal shows "Waiting for a connection"
  (still signed in) and loads by itself when the signal returns.
- **Requests** (`src/api.js`, `network`): loading data times out after 20 s
  and is tried three times (about a minute: long enough for a sleeping
  Render server). Saves are sent once and never repeated by the app; a save
  that timed out says it may or may not have been saved. A session renewal
  that can't get through keeps you signed in.
- **Nothing typed is lost** (`src/drafts.js`): unsaved register changes and
  a half-entered mark are kept on the phone per signed-in person, restored
  on reopening, deleted on sign-out and after a week. The register saves
  what it can and keeps the rest; after a failure it checks with the server
  before offering to save again, so nothing is created twice.

## Deployment (not yet done)

The plan (per the project status doc) is Vercel for this frontend, Render
for the Django backend. Not yet executed — this is local-dev-only as of now.
When deploying:
1. Set `VITE_API_BASE_URL` in Vercel's environment variables to the deployed
   backend's URL.
2. Update the backend's `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` (in
   `.env`, as a comma-separated list) to include the deployed frontend's
   Vercel URL. Local dev already works out of the box —
   `django-cors-headers` is configured on the backend to allow
   `http://localhost:5173` by default — but the production frontend origin
   needs to be added explicitly once it has a real URL.

## Error monitoring (Sentry)

Optional, and off unless `VITE_SENTRY_DSN` is set (same no-op-if-unset
pattern as the backend's `SENTRY_DSN`). To turn it on, create a React
project in Sentry, then set `VITE_SENTRY_DSN` (and optionally
`VITE_SENTRY_ENVIRONMENT`) in Vercel's environment variables and redeploy.
Vite reads it at build time, so an existing deployment won't pick it up.

What gets reported:
- Render crashes. The whole app sits inside a Sentry error boundary
  (`src/main.jsx`), so a crash shows a "Something went wrong / Reload" card
  instead of a blank page.
- Unhandled errors and promise rejections, through Sentry's global handlers.
- Failed API calls from the `request()` wrapper in `src/api.js`, but only
  network failures and 5xx responses. 4xx responses are validation or
  permission errors that the UI already shows the user.

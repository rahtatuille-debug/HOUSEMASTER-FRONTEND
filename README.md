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
- No offline/optimistic UI — every action is a live request; there's no
  local caching beyond the current page load.

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

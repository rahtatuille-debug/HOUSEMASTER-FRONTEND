# Post-deploy smoke tests

A small Playwright suite, kept apart from the app (its own `package.json`),
for checking a deployment the way a person would. It is **not** part of
CI. Run it against local servers, or against a URL you choose.

```bash
cd e2e
npm install
npx playwright install chromium        # once
node run.mjs --frontend https://<frontend> --api https://<backend>
```

Accounts come from environment variables; a role without both is skipped:

| Variables | Used by |
|---|---|
| `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD` | every screen as an admin; the session refresh check |
| `E2E_TEACHER_EMAIL`, `E2E_TEACHER_PASSWORD` | every screen as a teacher |
| `E2E_PARENT_EMAIL`, `E2E_PARENT_PASSWORD` and `E2E_PARENT2_EMAIL`, `E2E_PARENT2_PASSWORD` | two parents of **different** children: neither sees or can reach the other |
| `E2E_RESET_EMAIL`, `E2E_RESET_PASSWORD`, `E2E_MAIL_LOG` | "Forgot password" end to end (local only: reads the link from the backend's console email output in `E2E_MAIL_LOG`) |

What it checks:

- **Identity:** each role gets its own menu (parents never see staff screens)
  and every screen opens with no console errors and no
  Content-Security-Policy reports.
- **Parents:** two parents of different families see no parents among their
  contacts, get "not found" for each other's children, and (where changes
  are allowed) a message to the other parent is refused exactly like one to
  an ID that doesn't exist.
- **Sessions:** with an expired access token, several screens at once
  trigger exactly one refresh, the refresh token rotates, and the user stays
  signed in.
- **Password reset:** the reset email arrives, the link sets a new password,
  the new password signs in, the old one doesn't, and an existing session on
  another device ends. The test then resets the password back.

**Changes data only when you say so.** Against anything other than
`localhost` / `127.0.0.1`, the steps that change data (sending a message,
resetting a password) are skipped unless you add `--allow-mutations`. Use it
only with test accounts. Tokens and passwords are never printed.

Extra Playwright arguments go after `--`, e.g.
`node run.mjs --frontend … --api … -- tests/identity.spec.js`.

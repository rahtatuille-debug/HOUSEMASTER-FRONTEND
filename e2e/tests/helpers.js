import { expect } from '@playwright/test'

export const FRONTEND = process.env.E2E_FRONTEND || 'http://127.0.0.1:5173'
export const API = process.env.E2E_API || 'http://127.0.0.1:8000'
export const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(FRONTEND)
// Steps that change data only run locally, or when --allow-mutations was given.
export const MUTATIONS_ALLOWED = IS_LOCAL || process.env.E2E_ALLOW_MUTATIONS === '1'

// Accounts come from the environment; nothing is hard-coded. A role without
// both variables set is skipped.
export function account(role) {
  const email = process.env[`E2E_${role}_EMAIL`]
  const password = process.env[`E2E_${role}_PASSWORD`]
  return email && password ? { email, password } : null
}

// Console errors and Content-Security-Policy reports seen by a page. The one
// expected browser message is a parent's /api/me/ 403 (the identity check).
export function watch(page, role) {
  const problems = []
  const csp = []
  let lastUrl = ''
  page.on('response', (r) => { if (r.status() >= 400) lastUrl = r.url() })
  page.on('console', (m) => {
    const text = m.text()
    if (/Content Security Policy|Report Only/i.test(text)) csp.push(text)
    else if (m.type() === 'error') {
      if (role === 'PARENT' && /status of 403/.test(text) && /\/api\/me\/$/.test(lastUrl)) return
      problems.push(text)
    }
  })
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`))
  return { problems, csp }
}

export async function signIn(page, { email, password }) {
  await page.goto('/')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type=submit]')
  await expect(page.locator('.sidebar-nav button').first()).toBeVisible({ timeout: 30_000 })
  const skip = page.getByRole('button', { name: /skip tour/i })
  if (await skip.count()) await skip.first().click()
}

export async function tabs(page) {
  return page.$$eval('.sidebar-nav button[data-tab]', (els) => els.map((e) => e.dataset.tab))
}

export async function token(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('housemaster_tokens') || 'null'))
}

// Refresh-token rotation (read-only apart from retiring old tokens): with an
// expired access token, several screens at once cause exactly one refresh,
// the refresh token is rotated, and the user stays signed in.
import { expect, test } from '@playwright/test'
import { account, signIn, tabs, token } from './helpers.js'

test('an expired session refreshes once and rotates', async ({ page }) => {
  const who = account('ADMIN') || account('TEACHER')
  test.skip(!who, 'set E2E_ADMIN_* or E2E_TEACHER_*')
  await signIn(page, who)
  const before = await token(page)
  await page.evaluate(() => {
    const t = JSON.parse(localStorage.getItem('housemaster_tokens'))
    localStorage.setItem('housemaster_tokens', JSON.stringify({ ...t, access: `expired.${t.access}` }))
  })
  let refreshes = 0
  page.on('request', (r) => { if (r.url().endsWith('/api/token/refresh/')) refreshes += 1 })
  const [one, two] = (await tabs(page)).slice(0, 2)
  await Promise.all([page.click(`.sidebar-nav button[data-tab="${two}"]`), page.click(`.sidebar-nav button[data-tab="${one}"]`)])
  await page.waitForLoadState('networkidle').catch(() => {})
  // Compare, never print: a failure message must not contain a real token.
  await expect.poll(async () => {
    const after = await token(page)
    return !!after && after.refresh !== before.refresh
  }, { message: 'refresh token rotated', timeout: 15_000 }).toBe(true)
  expect(refreshes).toBe(1)
  await expect(page.locator('.sidebar-nav button').first()).toBeVisible()
})

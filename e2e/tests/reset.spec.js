// "Forgot password" end to end. Changes data (sends an email, sets a new
// password), so it runs only locally or with --allow-mutations, and only
// when E2E_MAIL_LOG points at a file where the backend writes its emails
// (the console email backend's output), to read the reset link from.
import fs from 'node:fs'
import { expect, test } from '@playwright/test'
import { MUTATIONS_ALLOWED, account } from './helpers.js'

test('forgot password: email link, new password works, old one and old sessions do not', async ({ page, browser }) => {
  const who = account('RESET')
  test.skip(!MUTATIONS_ALLOWED, 'changes data: local only, or --allow-mutations')
  test.skip(!who || !process.env.E2E_MAIL_LOG, 'set E2E_RESET_EMAIL/PASSWORD (an account you can reset) and E2E_MAIL_LOG')
  const mailLog = process.env.E2E_MAIL_LOG
  const old = await (await browser.newContext()).newPage()
  await old.goto('/'); await old.fill('#email', who.email); await old.fill('#password', who.password); await old.click('button[type=submit]')
  await expect(old.locator('.sidebar-nav button').first()).toBeVisible({ timeout: 30_000 })

  // Request a reset, read the link from the emails, set `password`.
  async function resetTo(password) {
    const start = fs.readFileSync(mailLog, 'utf8').length
    await page.goto('/')
    await page.click('text=Forgot password')
    await page.fill('#forgot-email', who.email)
    await page.click('button:text("Send reset link")')
    await expect(page.locator('.success-banner')).toContainText('If that email has an account')
    let link
    await expect.poll(() => {
      const text = fs.readFileSync(mailLog, 'utf8').slice(start).replace(/=\r?\n/g, '')
      link = (text.match(/https?:\/\/\S+\/reset-password\/[A-Za-z0-9_-]+/) || [])[0]
      return !!link
    }, { message: 'reset email arrived', timeout: 15_000 }).toBe(true)
    await page.goto(new URL(link).pathname)
    await page.fill('#reset-password', password)
    await page.fill('#reset-confirm', password)
    await page.click('button:text("Reset password")')
    await expect(page.locator('#email')).toBeVisible()
  }

  const fresh = `E2e-${Date.now()}-Pass`
  await resetTo(fresh)
  await page.fill('#email', who.email); await page.fill('#password', fresh); await page.click('button[type=submit]')
  await expect(page.locator('.sidebar-nav button').first()).toBeVisible({ timeout: 30_000 })

  const retry = await (await browser.newContext()).newPage()
  await retry.goto('/'); await retry.fill('#email', who.email); await retry.fill('#password', who.password); await retry.click('button[type=submit]')
  await expect(retry.locator('.error-banner')).toBeVisible()

  await old.reload()
  await expect(old.locator('#email')).toBeVisible({ timeout: 15_000 })

  // Put the original password back, so the account is as it was (and no
  // password is ever printed).
  await page.evaluate(() => localStorage.clear())
  await resetTo(who.password)
})

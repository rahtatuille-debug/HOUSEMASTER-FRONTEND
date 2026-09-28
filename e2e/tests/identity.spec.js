// Each role signs in, gets its own menu, and every screen opens with no
// console errors and no Content-Security-Policy reports. Read-only.
import { expect, test } from '@playwright/test'
import { account, signIn, tabs, watch } from './helpers.js'

const MENUS = {
  ADMIN: { has: ['staff', 'grades', 'messages'], lacks: [] },
  TEACHER: { has: ['grades', 'messages'], lacks: ['staff'] },
  PARENT: { has: ['messages'], lacks: ['grades', 'staff', 'activity'] },
}

for (const role of Object.keys(MENUS)) {
  test(`${role.toLowerCase()}: own menu, every screen clean`, async ({ page }) => {
    const who = account(role)
    test.skip(!who, `set E2E_${role}_EMAIL and E2E_${role}_PASSWORD`)
    const seen = watch(page, role)
    await signIn(page, who)
    const menu = await tabs(page)
    for (const tab of MENUS[role].has) expect(menu, `menu has ${tab}`).toContain(tab)
    for (const tab of MENUS[role].lacks) expect(menu, `menu lacks ${tab}`).not.toContain(tab)
    for (const tab of menu) {
      await page.click(`.sidebar-nav button[data-tab="${tab}"]`)
      await page.waitForLoadState('networkidle').catch(() => {})
    }
    expect(seen.problems, 'console errors').toEqual([])
    expect(seen.csp, 'CSP reports').toEqual([])
  })
}

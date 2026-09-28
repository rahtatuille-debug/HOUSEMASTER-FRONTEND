// Two parents of different families: neither can see or reach the other.
// The API checks are read-only; trying to start a conversation with the
// other parent (it must be refused) only runs where changes are allowed.
import { expect, test } from '@playwright/test'
import { API, MUTATIONS_ALLOWED, account, signIn, token } from './helpers.js'

async function api(path, access, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${access}`, ...(init.headers || {}) },
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}

test('two parents never see or reach each other', async ({ browser }) => {
  const first = account('PARENT')
  const second = account('PARENT2')
  test.skip(!first || !second, 'set E2E_PARENT_* and E2E_PARENT2_* (parents of different children)')
  const sessions = []
  for (const who of [first, second]) {
    const page = await (await browser.newContext()).newPage()
    await signIn(page, who)
    sessions.push({ who, access: (await token(page)).access })
  }
  const profiles = []
  for (const s of sessions) {
    const me = await api('/api/guardian-me/', s.access)
    expect(me.status).toBe(200)
    const contacts = await api('/api/conversations/contacts/', s.access)
    expect(contacts.status).toBe(200)
    const list = Array.isArray(contacts.body) ? contacts.body : contacts.body.results
    expect(list.every((c) => c.kind !== 'guardian'), 'no parents among contacts').toBe(true)
    const children = await api('/api/guardian-students/', s.access)
    profiles.push({ ...s, userId: me.body.user_id ?? me.body.id, children: new Set((children.body.results || children.body).map((c) => c.id)) })
  }
  const shared = [...profiles[0].children].filter((id) => profiles[1].children.has(id))
  expect(shared, 'choose two parents of different children').toEqual([])
  for (const [a, b] of [[profiles[0], profiles[1]], [profiles[1], profiles[0]]]) {
    for (const id of b.children) {
      expect((await api(`/api/guardian-students/${id}/`, a.access)).status, "another family's child").toBe(404)
    }
  }
  if (!MUTATIONS_ALLOWED) return
  const [a, b] = profiles
  const other = await api('/api/conversations/', a.access, { method: 'POST', body: JSON.stringify({ participant_ids: [b.userId], body: 'e2e check' }) })
  const nobody = await api('/api/conversations/', a.access, { method: 'POST', body: JSON.stringify({ participant_ids: [987654321], body: 'e2e check' }) })
  expect(other.status).toBe(400)
  expect(other.body, 'refused exactly like an unknown ID').toEqual(nobody.body)
})

// Phone and browser notifications: a parent turns them on for this device on the Profile page.
import { describe, expect, it, vi, afterEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from './test/apiMock.js'
import { serviceWorkerSource } from '../vite.config.js'

const mockApi = { current: null }
vi.mock('./api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Profile } = await import('./panels/Profile.jsx')
const { urlBase64ToBytes } = await import('./push.js')

const me = { name: 'Pat', school: { name: 'Alpha Academy' }, students: [], contact: { email_notifications: true } }
const subJson = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BPk', auth: 'xyz' } }

function fakeBrowser({ existing = null, permission = 'granted' } = {}) {
  let current = existing
  const sub = () => ({ endpoint: subJson.endpoint, toJSON: () => subJson, unsubscribe: vi.fn(() => { current = null; return Promise.resolve(true) }) })
  const pushManager = {
    getSubscription: vi.fn(() => Promise.resolve(current)),
    subscribe: vi.fn(() => { current = sub(); return Promise.resolve(current) }),
  }
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true,
    value: { getRegistration: () => Promise.resolve({ pushManager }) } })
  window.PushManager = function PushManager() {}
  window.Notification = { permission, requestPermission: vi.fn(() => Promise.resolve(permission)) }
  return { pushManager, makeSub: sub }
}

afterEach(() => {
  delete navigator.serviceWorker
  delete window.PushManager
  delete window.Notification
})

describe('Phone and browser notifications', () => {
  it('a parent turns them on for this device, and off again', async () => {
    const { pushManager } = fakeBrowser()
    const subscribe = vi.fn(() => Promise.resolve({}))
    const unsubscribe = vi.fn(() => Promise.resolve())
    mockApi.current = deepApiMock({ 'push.settings': () => Promise.resolve({ enabled: true, public_key: 'BAAA', subscribed: false }),
      'push.subscribe': subscribe, 'push.unsubscribe': unsubscribe })
    render(<Profile me={me} identityKind="guardian" onUserUpdated={() => {}} />)
    const box = await screen.findByLabelText(/Notify me on this phone or browser/)
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(subscribe).toHaveBeenCalledWith(subJson))
    expect(pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: expect.any(Uint8Array) })
    await waitFor(() => expect(box).toBeChecked())
    fireEvent.click(box)
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledWith(subJson.endpoint))
    await waitFor(() => expect(box).not.toBeChecked())
  })

  it('says so when the parent blocked notifications in the browser', async () => {
    fakeBrowser({ permission: 'denied' })
    const subscribe = vi.fn()
    mockApi.current = deepApiMock({ 'push.settings': () => Promise.resolve({ enabled: true, public_key: 'BAAA', subscribed: false }),
      'push.subscribe': subscribe })
    render(<Profile me={me} identityKind="guardian" onUserUpdated={() => {}} />)
    fireEvent.click(await screen.findByLabelText(/Notify me on this phone or browser/))
    expect(await screen.findByText(/blocked notifications/)).toBeInTheDocument()
    expect(subscribe).not.toHaveBeenCalled()
  })

  it('is not offered until the school has set it up, or where the browser cannot do it', async () => {
    fakeBrowser()
    mockApi.current = deepApiMock({ 'push.settings': () => Promise.resolve({ enabled: false, public_key: '', subscribed: false }) })
    const { unmount } = render(<Profile me={me} identityKind="guardian" onUserUpdated={() => {}} />)
    await screen.findByText('Your contact details')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByLabelText(/Notify me on this phone or browser/)).toBeNull()
    unmount()
    delete window.PushManager
    const settings = vi.fn(() => Promise.resolve({ enabled: true, public_key: 'BAAA', subscribed: false }))
    mockApi.current = deepApiMock({ 'push.settings': settings })
    render(<Profile me={me} identityKind="guardian" onUserUpdated={() => {}} />)
    await screen.findByText('Your contact details')
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByLabelText(/Notify me on this phone or browser/)).toBeNull()
  })

  it('shows as on when this device already has it', async () => {
    const browser = fakeBrowser()
    fakeBrowser({ existing: browser.makeSub() })
    mockApi.current = deepApiMock({ 'push.settings': () => Promise.resolve({ enabled: true, public_key: 'BAAA', subscribed: true }) })
    render(<Profile me={me} identityKind="guardian" onUserUpdated={() => {}} />)
    await waitFor(() => expect(screen.getByLabelText(/Notify me on this phone or browser/)).toBeChecked())
  })

  it('decodes the server key', () => {
    expect(Array.from(urlBase64ToBytes('AQID'))).toEqual([1, 2, 3])
    expect(Array.from(urlBase64ToBytes('-_8'))).toEqual([251, 255])
  })

  it('the service worker shows the notice and opens HouseMaster on a tap, never another site', () => {
    const sw = serviceWorkerSource(['/'])
    expect(sw).toContain("self.addEventListener('push'")
    expect(sw).toContain('showNotification')
    expect(sw).toContain("self.addEventListener('notificationclick'")
    // A tap opens a page on this site only.
    expect(sw).toMatch(/new URL\([^)]*self\.location\.origin\)/)
    expect(sw).toContain('url.origin !== self.location.origin')
  })
})

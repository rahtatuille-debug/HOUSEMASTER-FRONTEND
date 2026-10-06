// Phone and browser notifications (web push) for one device. The server
// sends a short notice when the school publishes an announcement or a
// report; the service worker (vite.config.js) shows it.
import { api } from './api.js'

export function urlBase64ToBytes(text) {
  const padded = (text + '='.repeat((4 - (text.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
}

// The service worker registration, or null where push can't work (development
// builds, old browsers, iPhones unless HouseMaster is added to the home screen).
export async function pushRegistration() {
  if (typeof window === 'undefined' || !('PushManager' in window) || !('Notification' in window)) return null
  if (!navigator.serviceWorker?.getRegistration) return null
  try {
    return (await navigator.serviceWorker.getRegistration()) || null
  } catch {
    return null
  }
}

export async function currentSubscription(registration) {
  try {
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

export class NotificationsBlocked extends Error {}

export async function turnOn(registration, publicKey) {
  const permission = window.Notification.permission === 'granted'
    ? 'granted' : await window.Notification.requestPermission()
  if (permission !== 'granted') throw new NotificationsBlocked('Notifications are blocked for HouseMaster in this browser.')
  const sub = (await currentSubscription(registration))
    || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) })
  await api.push.subscribe(sub.toJSON())
  return sub
}

export async function turnOff(registration) {
  const sub = await currentSubscription(registration)
  if (!sub) return
  await api.push.unsubscribe(sub.endpoint)
  await sub.unsubscribe().catch(() => {})
}

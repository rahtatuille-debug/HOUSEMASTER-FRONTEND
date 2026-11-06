import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
  globalThis.localStorage?.clear()
  globalThis.sessionStorage?.clear()
  // Pages are in the address bar: each test starts at the front page.
  globalThis.window?.history.replaceState({}, '', '/')
})

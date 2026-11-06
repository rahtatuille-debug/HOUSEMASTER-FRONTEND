// A school still being set up is closed to everyone but its admins: the app says so and can check again.
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { deepApiMock } from './test/apiMock.js'

const mockApi = { current: null }
vi.mock('./api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: App } = await import('./App.jsx')

describe('a school that is not open yet', () => {
  it('tells a parent so, with Check again', async () => {
    const closed = () => Promise.reject(Object.assign(new Error('Forbidden'), {
      status: 403, data: { code: 'school_not_open', detail: 'Your school is still being set up on HouseMaster.' } }))
    const notStaff = () => Promise.reject(Object.assign(new Error('Forbidden'), { status: 403 }))
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: notStaff, guardianMe: closed })
    render(<App />)
    expect(await screen.findByText('Your school isn’t open yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument()
  })
})

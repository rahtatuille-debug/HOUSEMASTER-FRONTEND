import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from './test/apiMock.js'

// Opening the app with no signal: the phone is still signed in, so it must
// say it's waiting for a connection, never look blank or ask for the
// password again.
const mockApi = { current: null }
vi.mock('./api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: App } = await import('./App.jsx')
const { connection } = await import('./connection.js')

function noSignal() {
  const err = new Error('You’re offline. This will load when you’re back online.')
  err.network = true
  return Promise.reject(err)
}

const school = { id: 1, name: 'Alpha Academy', setup_completed: true, education_system: 'cbc' }
const teacher = { id: 2, name: 'Njeri', role: 'teacher', tour_seen: true, school, assignments: [] }
// What the teacher's home screen loads once the app gets through (without
// it the screen throws after the test has passed, depending on timing).
const teacherHome = { checklist: { system: 'cbc', hidden: false, steps: [], done: 0, total: 0 }, classes: [] }

describe('opening the app without a signal', () => {
  it('shows that it is loading instead of a blank page', () => {
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: () => new Promise(() => {}) })
    render(<App />)
    expect(screen.getByText(/Loading HouseMaster/i)).toHaveClass('loading-note')
  })

  it('says it is waiting for a connection and keeps the person signed in', async () => {
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: noSignal })
    const { container } = render(<App />)
    expect(await screen.findByText(/can’t reach HouseMaster/i)).toBeInTheDocument()
    expect(container.querySelector('#password')).toBeNull()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('loads by itself once the connection is back', async () => {
    let online = false
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => (online ? Promise.resolve(teacher) : noSignal()),
      'teacherHome.get': () => Promise.resolve(teacherHome),
    })
    const { container } = render(<App />)
    await screen.findByText(/can’t reach HouseMaster/i)
    online = true
    act(() => {
      connection.report(false)
      connection.report(true)
    })
    await waitFor(() => expect(container.querySelector('.rail [data-section="registers"]')).toBeInTheDocument())
  })

  it('tries again when asked', async () => {
    let online = false
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => (online ? Promise.resolve(teacher) : noSignal()),
      'teacherHome.get': () => Promise.resolve(teacherHome),
    })
    const { container } = render(<App />)
    await screen.findByText(/can’t reach HouseMaster/i)
    online = true
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(container.querySelector('.rail [data-section="registers"]')).toBeInTheDocument())
  })

  it('waits too when the server is down, rather than asking for the password', async () => {
    const down = () => {
      const err = new Error('Request failed (503)')
      err.status = 503
      return Promise.reject(err)
    }
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: down })
    const { container } = render(<App />)
    expect(await screen.findByText(/can’t reach HouseMaster/i)).toBeInTheDocument()
    expect(container.querySelector('#password')).toBeNull()
  })

  it('still goes to sign-in when the session has really ended', async () => {
    const expired = () => {
      const err = new Error('Session expired. Please log in again.')
      err.isAuthError = true
      return Promise.reject(err)
    }
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: expired })
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('#password')).toBeInTheDocument())
  })
})

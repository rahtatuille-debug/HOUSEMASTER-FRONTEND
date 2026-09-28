import { describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { deepApiMock } from './test/apiMock.js'

// The identity fork: staff have a profile (/api/me/ works); parents don't
// (/api/me/ answers 403, then /api/guardian-me/ works). Each gets its own
// menu, and a parent must never be shown the staff screens.
const mockApi = { current: null }
vi.mock('./api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: App } = await import('./App.jsx')

function forbidden() {
  const err = new Error('Forbidden')
  err.status = 403
  return Promise.reject(err)
}

const school = { id: 1, name: 'Alpha Academy', setup_completed: true, education_system: 'cbc' }

describe('identity fork', () => {
  it('shows the staff menu for a staff account', async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [] }),
    })
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('[data-tab="grades"]')).toBeInTheDocument())
    expect(container.querySelector('[data-tab="staff"]')).toBeInTheDocument()
  })

  it('falls back to the parent menu when /api/me/ answers 403', async () => {
    const guardianMe = vi.fn(() => Promise.resolve({ id: 7, name: 'Grace', school, students: [] }))
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden, guardianMe })
    const { container } = render(<App />)
    await waitFor(() => expect(guardianMe).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('[data-tab="messages"]')).toBeInTheDocument())
    expect(container.querySelector('[data-tab="grades"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-tab="staff"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-tab="activity"]')).not.toBeInTheDocument()
  })

  it('goes back to sign-in when neither identity works', async () => {
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden, guardianMe: forbidden })
    const { findByRole } = render(<App />)
    expect(await findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

// What /api/dashboard/ and /api/checklist/ return (an empty school). The
// admin home page reads both; without them the page threw after the menu
// had rendered, and the test passed or failed depending on timing.
const dashboard = {
  attendance_today: { date: '2026-09-28', is_today: true, students: 0, marked: 0, absent: 0, rate: 0,
    classes_not_taken: [], classes: [] },
  reports_waiting: { count: 0, items: [] },
  requests_waiting: 0,
  parent_signups_waiting: 0,
  invites: { pending: 0, expired: 0, items: [] },
  students_without_parent: { count: 0, total_students: 0, items: [] },
  active_alerts: [],
}
const checklist = { system: 'cbc', hidden: false, steps: [], done: 0, total: 0 }

describe('identity fork', () => {
  it('shows the staff menu for a staff account', async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [] }),
      dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve(checklist),
    })
    const { container, findByText } = render(<App />)
    await waitFor(() => expect(container.querySelector('.rail [data-section="reports"]')).toBeInTheDocument())
    expect(container.querySelector('.rail [data-section="admin"]')).toBeInTheDocument()
    // The home page itself renders, rather than crashing after the menu.
    expect(await findByText(/Good (morning|afternoon), Amina/)).toBeInTheDocument()
    // A section opens on its first page, with its other pages as tabs along the top.
    fireEvent.click(container.querySelector('.rail [data-section="admin"]'))
    const tabs = within(await screen.findByRole('tablist', { name: 'Admin' }))
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Setup', 'Staff', 'Parents', 'Approvals', 'Activity log'])
    expect(tabs.getByRole('tab', { name: 'Setup' })).toHaveAttribute('aria-selected', 'true')
  })

  it('a teacher sees five sections; Setup and their requests are in the profile menu', async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 2, name: 'Tom', role: 'teacher', tour_seen: true, school, assignments: [] }),
      'teacherHome.get': () => Promise.resolve({ classes: [], checklist: { hidden: true, steps: [], done: 0, total: 0 }, today: [] }),
    })
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.rail [data-section="reports"]')).toBeInTheDocument())
    expect([...container.querySelectorAll('.rail [data-section]')].map((b) => b.dataset.section))
      .toEqual(['home', 'registers', 'reports', 'messages', 'students'])
    // All five fit the phone's bottom bar, so there's no "More".
    expect(container.querySelector('.bottom-bar [data-section="more"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Your profile' }))
    expect(screen.getByRole('button', { name: 'My requests' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Setup' })).toBeInTheDocument()
  })

  it('an admin on a phone gets four sections and More, which lists everything', async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [] }),
      dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve(checklist),
      'activity.list': () => Promise.resolve({ results: [], next: null }),
    })
    const { container } = render(<App />)
    await waitFor(() => expect(container.querySelector('.bottom-bar [data-section="more"]')).toBeInTheDocument())
    expect([...container.querySelectorAll('.bottom-bar [data-section]')].map((b) => b.dataset.section))
      .toEqual(['home', 'registers', 'reports', 'messages', 'more'])
    fireEvent.click(container.querySelector('.bottom-bar [data-section="more"]'))
    const sheet = within(screen.getByRole('dialog', { name: 'Everything in HouseMaster' }))
    fireEvent.click(sheet.getByRole('button', { name: 'Activity log' }))
    expect(await screen.findByRole('tab', { name: 'Activity log' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('dialog', { name: 'Everything in HouseMaster' })).toBeNull()
  })

  it('falls back to the parent menu when /api/me/ answers 403', async () => {
    const guardianMe = vi.fn(() => Promise.resolve({ id: 7, name: 'Grace', school, students: [] }))
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden, guardianMe })
    const { container } = render(<App />)
    await waitFor(() => expect(guardianMe).toHaveBeenCalled())
    await waitFor(() => expect(container.querySelector('.rail [data-section="messages"]')).toBeInTheDocument())
    expect(container.querySelector('[data-section="reports"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-section="admin"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-quick="grades"]')).not.toBeInTheDocument()
    expect(container.querySelector('[data-tab="activity"]')).not.toBeInTheDocument()
  })

  it('goes back to sign-in when neither identity works', async () => {
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden, guardianMe: forbidden })
    const { findByRole } = render(<App />)
    expect(await findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })
})

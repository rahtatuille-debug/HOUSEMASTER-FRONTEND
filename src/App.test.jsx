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
    expect(tabs.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Setup', 'Staff', 'Parents', 'Approvals', 'Activity log', 'Billing'])
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

  it('a refresh stays on the page that was open, and signing out forgets it', async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [] }),
      dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve(checklist),
      'activity.list': () => Promise.resolve({ results: [], next: null }),
    })
    const first = render(<App />)
    await waitFor(() => expect(first.container.querySelector('.rail [data-section="admin"]')).toBeInTheDocument())
    fireEvent.click(first.container.querySelector('.rail [data-section="admin"]'))
    fireEvent.click(within(await screen.findByRole('tablist', { name: 'Admin' })).getByRole('tab', { name: 'Activity log' }))
    first.unmount()
    // The refresh.
    const { container } = render(<App />)
    expect(await screen.findByRole('tab', { name: 'Activity log' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText(/Good (morning|afternoon|evening), Amina/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Your profile' }))
    fireEvent.click(screen.getAllByRole('button', { name: /Log out/ })[0])
    await waitFor(() => expect(container.querySelector('.rail')).toBeNull())
    expect(sessionStorage.getItem('hm.page.tab') ?? '').not.toContain('activity')
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
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden, guardianMe: forbidden, 'student.me': forbidden })
    const { findByRole } = render(<App />)
    expect(await findByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('a student account must choose a password first, then sees My work and Calendar', async () => {
    const student = { id: 50, role: 'student', name: 'Amina K', first_name: 'Amina', student_id: 7, username: 'amina.k4821',
      class_name: '2 East', must_change_password: true, school: { name: 'Alpha', setup_completed: true } }
    const changePassword = vi.fn(() => Promise.resolve({ access: 'a', refresh: 'r' }))
    let calls = 0
    mockApi.current = deepApiMock({
      isLoggedIn: () => true, me: forbidden, guardianMe: forbidden,
      'student.me': () => Promise.resolve(calls++ === 0 ? student : { ...student, must_change_password: false }),
      'student.changePassword': changePassword,
      'guardianStudents.profile': () => Promise.resolve({ student: { id: 7, first_name: 'Amina', last_name: 'K' }, age: 12, teachers: [],
        subjects: [], attendance: null, performance: [], support: null, discipline: [], merits: [], clubs: [], homework: [] }),
      'guardianStudents.grades': () => Promise.resolve([]), 'guardianStudents.reports': () => Promise.resolve([]),
    })
    const { findByText, findByLabelText, getByLabelText, getByRole, findByRole } = render(<App />)
    expect(await findByText(/amina.k4821/)).toBeInTheDocument()
    fireEvent.change(await findByLabelText('The password you were given'), { target: { value: 'river-tiger-47' } })
    fireEvent.change(getByLabelText('New password'), { target: { value: 'Correct-Horse-9' } })
    fireEvent.change(getByLabelText('New password again'), { target: { value: 'Correct-Horse-9' } })
    fireEvent.click(getByRole('button', { name: 'Save and continue' }))
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ current_password: 'river-tiger-47', new_password: 'Correct-Horse-9' }))
    expect(await findByText('My work', { selector: '.eyebrow' })).toBeInTheDocument()
    expect((await screen.findAllByRole('button', { name: /Calendar/ })).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /Students/ })).toBeNull()
  })
})

describe('online only', () => {
  it("says when HouseMaster can't be reached, keeps the person signed in, and tries again when asked", async () => {
    let calls = 0
    const me = vi.fn(() => {
      calls += 1
      if (calls === 1) return Promise.reject(Object.assign(new Error('Could not reach the server.'), { network: true }))
      return Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [] })
    })
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me, dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve(checklist) })
    const { container } = render(<App />)
    expect(await screen.findByText('Can’t reach HouseMaster')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(container.querySelector('.rail [data-section="admin"]')).toBeInTheDocument())
  })
})

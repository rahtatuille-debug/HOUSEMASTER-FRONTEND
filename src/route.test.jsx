// Pages in the address bar: a link or bookmark opens that page, moving between pages adds history,
// and Back returns to the page before.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from './test/apiMock.js'
import { pathFor, readRoute } from './route.js'

const mockApi = { current: null }
vi.mock('./api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: App } = await import('./App.jsx')

const school = { id: 1, name: 'Alpha', grading_scale: 'percentage', setup_completed: true, setup_stage: 'done', levels: [] }
const admin = () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [] })

describe('reading the address', () => {
  it('knows pages and an open student, and leaves token links alone', () => {
    expect(readRoute('/attendance')).toEqual({ tab: 'attendance', params: null })
    expect(readRoute('/students/42')).toEqual({ tab: 'students', params: { studentId: 42 } })
    expect(readRoute('/join/abc')).toBeNull()
    expect(readRoute('/reset-password/abc/')).toBeNull()
    expect(readRoute('/')).toBeNull()
    expect(pathFor('home')).toBe('/')
    expect(pathFor('students', { studentId: 7 })).toBe('/students/7')
  })
})

describe('the app', () => {
  it('opens the page in the address bar, adds history when moving on, and goes back', async () => {
    window.history.replaceState({}, '', '/staff')
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: admin })
    render(<App />)
    expect(await screen.findByRole('tab', { name: 'Staff' })).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByRole('tab', { name: 'Parents' }))
    await waitFor(() => expect(window.location.pathname).toBe('/parents'))
    act(() => {
      window.history.replaceState({}, '', '/staff')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Staff' })).toHaveAttribute('aria-selected', 'true'))
  })
})

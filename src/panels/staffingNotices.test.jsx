// F: deactivating a teacher says which lessons are left without them; changing options says what now clashes.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Staff } = await import('./Staff.jsx')
const { default: SubjectChoicesCard } = await import('./SubjectChoicesCard.jsx')

describe('F: staffing and option notices', () => {
  it('deactivating a teacher says their lessons are now unstaffed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi.current = deepApiMock({
      'staff.list': () => Promise.resolve([{ id: 7, name: 'Mr Ode', email: 'ode@example.test', role: 'teacher', is_active: true }]),
      'staff.deactivate': () => Promise.resolve({ id: 7, lessons: [{ id: 1 }, { id: 2 }] }),
    })
    render(<Staff me={{ role: 'admin', id: 1 }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText(/2 lessons on the timetable now have no teacher/)).toBeInTheDocument()
    window.confirm.mockRestore()
  })
})

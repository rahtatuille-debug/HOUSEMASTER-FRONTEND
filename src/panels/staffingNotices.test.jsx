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

  it('saving options that make lessons clash shows the clashes', async () => {
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 5, name: '10A' }]),
      'subjectChoices.get': () => Promise.resolve({ system: 'british', pathways: [], timetable_clashes: [],
        subjects: [{ id: 2, name: 'French', is_elective: true }], students: [{ student: 1, name: 'Ann K', pathway: '', subjects: [] }] }),
      'subjectChoices.save': () => Promise.resolve({ system: 'british', pathways: [],
        timetable_clashes: ['1 student in 10A now take both French and Music, which are both on Monday Lesson 1.'],
        subjects: [{ id: 2, name: 'French', is_elective: true }], students: [{ student: 1, name: 'Ann K', pathway: '', subjects: [{ subject: 2, level: '' }] }] }),
    })
    render(<SubjectChoicesCard me={{ role: 'admin' }} />)
    await waitFor(() => expect(screen.getAllByRole('option', { name: '10A' }).length).toBe(1))
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '5' } })
    fireEvent.click(await screen.findByLabelText('Ann K takes French'))
    fireEvent.click(screen.getByRole('button', { name: /Save/ }))
    expect(await screen.findByText(/now take both French and Music/)).toBeInTheDocument()
  })
})

// The Attendance page opens on every class's numbers for the day, with a tab per class.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))
const { default: Attendance } = await import('./Attendance.jsx')

const summary = {
  date: '2026-10-07',
  classes: [
    { id: 1, name: '7A', year_group: 'Grade 7', students: 3, marked: 3, present: 1, late: 1, absent: 1, excused: 0 },
    { id: 2, name: '7B', year_group: 'Grade 7', students: 2, marked: 0, present: 0, late: 0, absent: 0, excused: 0 },
  ],
  totals: { students: 5, marked: 3, present: 1, late: 1, absent: 1, excused: 0, not_taken: 1 },
}

describe('Attendance overview', () => {
  it('opens on every class with present, absent and registers not taken', async () => {
    const students = vi.fn(() => Promise.resolve([]))
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 1, name: '7A' }, { id: 2, name: '7B' }]),
      'attendance.summary': () => Promise.resolve(summary),
      'students.list': students,
    })
    render(<Attendance me={{ role: 'admin' }} />)
    const tabs = within(await screen.findByRole('tablist'))
    await waitFor(() => expect(tabs.getByRole('tab', { name: '7A: 2 present, 1 absent' })).toBeInTheDocument())
    expect(tabs.getByRole('tab', { name: '7B: register not taken' })).toBeInTheDocument()
    expect(tabs.getByRole('tab', { name: /^All/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('1 register not taken')).toBeInTheDocument()
    const table = screen.getByRole('table')
    expect(within(table).getByRole('row', { name: /7A · Grade 7 1 1 1 3 \/ 3 Open/ })).toBeInTheDocument()
    expect(students).not.toHaveBeenCalled()  // no register is loaded until a class is chosen
    fireEvent.click(within(table).getByRole('button', { name: 'Take register' }))
    expect(tabs.getByRole('tab', { name: /^7B/ })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(students).toHaveBeenCalledWith({ school_class: '2', is_active: true }))
  })

  it('still works on a server without the summary', async () => {
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 1, name: '7A' }, { id: 2, name: '7B' }]),
      'attendance.summary': () => Promise.reject(new Error('Not found')),
    })
    render(<Attendance me={{ role: 'admin' }} />)
    expect(await screen.findByRole('tab', { name: '7B' })).toBeInTheDocument()
  })
})

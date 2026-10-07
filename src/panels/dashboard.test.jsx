// The panel dashboards: the day, what needs attention, school numbers, and a student search.
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

const { default: Home } = await import('./Home.jsx')
const { default: TeacherHome } = await import('./TeacherHome.jsx')

const dashboard = {
  attendance_today: { date: '2026-10-07', is_today: true, students: 3, marked: 0, absent: 0, rate: null,
    classes_not_taken: ['7A', '7B'], classes: [{ id: 1, name: '7A', students: 2, marked: 0, absent: 0, late: 0 }] },
  reports_waiting: { count: 1, items: [{ id: 5, student: 'Ann A', term: 'Term 1' }] },
  requests_waiting: 0, parent_signups_waiting: 0, invites: { pending: 0, expired: 0, items: [] },
  students_without_parent: { count: 0, total_students: 3, items: [] }, active_alerts: [],
  students_by_year_group: [{ id: 1, name: 'Year 7', female: 1, male: 2, total: 3 }],
}

describe('Admin dashboard', () => {
  it('shows panels for the day, what needs attention and the school numbers', async () => {
    mockApi.current = deepApiMock({
      dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve({ hidden: true, steps: [], done: 0, total: 0 }),
      'teacherHome.get': () => Promise.resolve({ today: [{ id: 3, start_time: '08:00', end_time: '08:40', class_name: '7A', label: 'Maths' }] }),
      'announcements.page': () => Promise.resolve({ results: [{ id: 9, title: 'Sports day', created_by_name: 'Head' }] }),
    })
    const onNavigate = vi.fn()
    render(<Home me={{ name: 'Amina Hale', role: 'admin' }} onNavigate={onNavigate} onStartTour={() => {}} />)
    const day = within(await screen.findByRole('region', { name: 'My day' }))
    fireEvent.click(day.getByRole('button', { name: 'Take the register for 7A Maths' }))
    expect(onNavigate).toHaveBeenCalledWith('attendance')
    const attention = within(screen.getByRole('region', { name: 'Needs attention' }))
    expect(attention.getByText('2 registers not taken today: 7A, 7B')).toBeInTheDocument()
    expect(attention.getByText('1 report waiting for approval')).toBeInTheDocument()
    const numbers = within(screen.getByRole('region', { name: 'School numbers' }))
    expect(numbers.getByRole('row', { name: /Year 7 1 2 3/ })).toBeInTheDocument()
    expect(await within(screen.getByRole('region', { name: 'Daily bulletin' })).findByText('Sports day')).toBeInTheDocument()
  })

  it('a finished first-week checklist takes one line', async () => {
    mockApi.current = deepApiMock({
      dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve({ hidden: false, done: 2, total: 2, steps: [{ key: 'a', title: 'Invite your teachers', done: true }, { key: 'b', title: 'Add students', done: true }] }),
    })
    render(<Home me={{ name: 'Amina', role: 'admin' }} onNavigate={() => {}} onStartTour={() => {}} />)
    expect(await screen.findByText('Your first week is done.')).toBeInTheDocument()
    expect(screen.queryByText('Invite your teachers')).toBeNull()
  })

  it('the student search opens a profile', async () => {
    mockApi.current = deepApiMock({
      dashboard: () => Promise.resolve(dashboard),
      'checklist.get': () => Promise.resolve({ hidden: true, steps: [], done: 0, total: 0 }),
      'students.page': () => Promise.resolve({ results: [{ id: 42, first_name: 'Oliver', last_name: 'Ali', external_id: 'HDC042' }] }),
    })
    const onNavigate = vi.fn()
    render(<Home me={{ name: 'Amina', role: 'admin' }} onNavigate={onNavigate} onStartTour={() => {}} />)
    fireEvent.change(await screen.findByLabelText('Student name or admission number'), { target: { value: 'Oli' } })
    const find = within(screen.getByRole('region', { name: 'Find a student' }))
    fireEvent.click(await find.findByRole('button', { name: 'Open' }))
    expect(onNavigate).toHaveBeenCalledWith('students', { studentId: 42 })
  })
})

describe('Teacher dashboard', () => {
  it('registers not taken are one line, not one per class', async () => {
    mockApi.current = deepApiMock({
      'teacherHome.get': () => Promise.resolve({
        checklist: { hidden: true, steps: [], done: 0, total: 0 }, today: [],
        classes: ['7A', '7B', '7C', '8A', '8B'].map((name, i) => ({ id: i, name, year_group: 'Y', students: 1, subjects: [], register_taken_today: false })),
      }),
    })
    render(<TeacherHome me={{ name: 'Tom' }} onNavigate={() => {}} onStartTour={() => {}} />)
    const attention = within(await screen.findByRole('region', { name: 'Needs attention' }))
    expect(attention.getByText('5 registers not taken today: 7A, 7B, 7C, 8A…')).toBeInTheDocument()
    expect(attention.getAllByRole('button', { name: 'Register' })).toHaveLength(1)
    await waitFor(() => expect(screen.getByText('No lessons on your timetable today.')).toBeInTheDocument())
  })
})

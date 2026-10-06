// The timetable: admins place lessons in a class's week (clashes come back
// from the server as sentences), teachers see their own week, and the
// teacher home lists today's lessons.
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

const { default: Timetable } = await import('./Timetable.jsx')
const { default: WeekGrid } = await import('./WeekGrid.jsx')
const { default: TeacherHome } = await import('./TeacherHome.jsx')

const week = {
  title: '10A',
  days: [{ day: 1, name: 'Monday' }, { day: 2, name: 'Tuesday' }],
  periods: [
    { id: 1, name: 'Lesson 1', start_time: '08:00', end_time: '08:40', is_break: false },
    { id: 2, name: 'Break', start_time: '08:40', end_time: '09:00', is_break: true },
    { id: 3, name: 'Lesson 2', start_time: '09:00', end_time: '09:40', is_break: false },
  ],
  lessons: [{ id: 9, day: 1, period: 1, school_class: 5, class_name: '10A', subject: 2, title: '', label: 'Mathematics',
    teacher: 7, teacher_name: 'Ms Shah', room: 3, room_name: 'Lab 1' }],
}

function adminApi(overrides = {}) {
  return deepApiMock({
    'schoolClasses.list': () => Promise.resolve([{ id: 5, name: '10A' }, { id: 6, name: '10B' }]),
    'subjects.list': () => Promise.resolve([{ id: 2, name: 'Mathematics', label: 'Mathematics' }, { id: 4, name: 'French', label: 'French' }]),
    'timetable.rooms.list': () => Promise.resolve([{ id: 3, name: 'Lab 1' }]),
    'staff.list': () => Promise.resolve([{ id: 7, name: 'Ms Shah', is_active: true }, { id: 8, name: 'Mr Ode', is_active: true }]),
    'timetable.week': vi.fn(() => Promise.resolve(week)),
    ...overrides,
  })
}

describe('Week grid', () => {
  it('shows lessons by period and day, with breaks', () => {
    render(<WeekGrid week={week} show="teacher" />)
    const table = screen.getAllByRole('table')[0]
    expect(within(table).getByText('Mathematics')).toBeInTheDocument()
    expect(within(table).getByText('Ms Shah · Lab 1')).toBeInTheDocument()
    expect(within(table).getByText('Break')).toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: /Add a lesson/ })).toBeNull()
  })

  it('says when the school day is not set up', () => {
    render(<WeekGrid week={{ ...week, periods: [] }} />)
    expect(screen.getByText(/hasn't been set up/)).toBeInTheDocument()
  })
})

describe('Timetable page', () => {
  it("opens on the first class for admins and adds a lesson with the Staff page's teacher", async () => {
    const create = vi.fn(() => Promise.resolve({}))
    mockApi.current = adminApi({ 'timetable.lessons.create': create })
    render(<Timetable me={{ role: 'admin' }} />)
    await waitFor(() => expect(mockApi.current.timetable.week).toHaveBeenCalledWith({ school_class: '5' }))
    const table = (await screen.findAllByRole('table'))[0]
    fireEvent.click(within(table).getByRole('button', { name: 'Add a lesson on Tuesday Lesson 2' }))
    expect(screen.getByText(/Tuesday · Lesson 2/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Room'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }))
    expect(await screen.findByText('Lesson added.')).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith({ subject: 4, title: '', room: 3, school_class: 5, day: 2, period: 3 })
  })

  it('adds a double lesson in the next period', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    const twoLessons = { ...week, periods: [week.periods[0], { id: 4, name: 'Lesson 1b', start_time: '08:40',
      end_time: '09:20', is_break: false }], lessons: [] }
    mockApi.current = adminApi({ 'timetable.lessons.create': create, 'timetable.week': vi.fn(() => Promise.resolve(twoLessons)) })
    render(<Timetable me={{ role: 'admin' }} />)
    const table = (await screen.findAllByRole('table'))[0]
    fireEvent.click(within(table).getByRole('button', { name: 'Add a lesson on Monday Lesson 1' }))
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '2' } })
    fireEvent.click(screen.getByLabelText(/Double lesson \(also Lesson 1b\)/))
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }))
    expect(await screen.findByText('Double lesson added (Lesson 1 and Lesson 1b).')).toBeInTheDocument()
    expect(create.mock.calls.map((c) => c[0].period)).toEqual([1, 4])
  })

  it('F: a double lesson can give the second period its own teacher and room', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    const twoLessons = { ...week, periods: [week.periods[0], { id: 4, name: 'Lesson 1b', start_time: '08:40',
      end_time: '09:20', is_break: false }], lessons: [] }
    mockApi.current = adminApi({ 'timetable.lessons.create': create, 'timetable.week': vi.fn(() => Promise.resolve(twoLessons)) })
    render(<Timetable me={{ role: 'admin' }} />)
    const table = (await screen.findAllByRole('table'))[0]
    fireEvent.click(within(table).getByRole('button', { name: 'Add a lesson on Monday Lesson 1' }))
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Teacher'), { target: { value: '7' } })
    fireEvent.click(screen.getByLabelText(/Double lesson \(also Lesson 1b\)/))
    fireEvent.change(screen.getByLabelText('Teacher in Lesson 1b'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Room in Lesson 1b'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }))
    expect(await screen.findByText('Double lesson added (Lesson 1 and Lesson 1b).')).toBeInTheDocument()
    expect(create.mock.calls.map((c) => [c[0].period, c[0].teacher, c[0].room])).toEqual([[1, 7, null], [4, 8, 3]])
  })

  it('F: admins see lessons with no teacher, or a deactivated one', async () => {
    mockApi.current = adminApi({ 'timetable.unstaffed': () => Promise.resolve([{ id: 9, day: 1, day_name: 'Monday', period_name: 'Lesson 1',
      class_name: '10A', label: 'Mathematics', teacher_name: 'Mr Gone (inactive)', room_name: 'Lab 1' }]) })
    render(<Timetable me={{ role: 'admin' }} />)
    expect(await screen.findByText('Unstaffed lessons (1)')).toBeInTheDocument()
    expect(screen.getByText(/Mr Gone \(inactive\)/)).toBeInTheDocument()
  })

  it('has no double option before a break', async () => {
    mockApi.current = adminApi()
    render(<Timetable me={{ role: 'admin' }} />)
    const table = (await screen.findAllByRole('table'))[0]
    fireEvent.click(within(table).getByRole('button', { name: 'Add a lesson on Tuesday Lesson 1' }))  // then Break
    expect(screen.queryByLabelText(/Double lesson/)).toBeNull()
  })

  it('shows a clash the server refuses', async () => {
    const create = vi.fn(() => Promise.reject(Object.assign(new Error('Bad request'), {
      data: { non_field_errors: ['Ms Shah already teaches 10B Mathematics on Monday Lesson 1.'] },
    })))
    mockApi.current = adminApi({ 'timetable.lessons.create': create })
    render(<Timetable me={{ role: 'admin' }} />)
    const table = (await screen.findAllByRole('table'))[0]
    fireEvent.click(within(table).getByRole('button', { name: 'Add a lesson on Monday Lesson 1' }))
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add lesson' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already teaches 10B Mathematics')
  })

  it('changes and removes a lesson', async () => {
    const update = vi.fn(() => Promise.resolve({}))
    const remove = vi.fn(() => Promise.resolve({}))
    mockApi.current = adminApi({ 'timetable.lessons.update': update, 'timetable.lessons.remove': remove })
    render(<Timetable me={{ role: 'admin' }} />)
    const table = (await screen.findAllByRole('table'))[0]
    fireEvent.click(within(table).getByRole('button', { name: /Mathematics, Ms Shah/ }))
    fireEvent.change(screen.getByLabelText('Teacher'), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(9, { subject: 2, title: '', room: 3, teacher: 8 }))
    fireEvent.click(within((await screen.findAllByRole('table'))[0]).getByRole('button', { name: /Mathematics, Ms Shah/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith(9))
  })

  it("teachers open on their own week and can't edit", async () => {
    mockApi.current = adminApi({ 'timetable.week': vi.fn(() => Promise.resolve({ ...week, title: 'My timetable' })) })
    render(<Timetable me={{ role: 'teacher' }} />)
    await waitFor(() => expect(mockApi.current.timetable.week).toHaveBeenCalledWith({}))
    const table = (await screen.findAllByRole('table'))[0]
    expect(within(table).queryByRole('button', { name: /Add a lesson/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'School day and rooms' })).toBeNull()
  })

  it('admins set up a standard school day', async () => {
    const standard = vi.fn(() => Promise.resolve([]))
    mockApi.current = adminApi({
      'timetable.schoolWeek.get': () => Promise.resolve({ days: [1, 2, 3, 4, 5] }),
      'timetable.periods.list': () => Promise.resolve([]),
      'timetable.periods.standard': standard,
    })
    render(<Timetable me={{ role: 'admin' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'School day and rooms' }))
    fireEvent.change(await screen.findByLabelText('Lessons a day'), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set up the day' }))
    await waitFor(() => expect(standard).toHaveBeenCalledWith({
      start: '08:00', lesson_minutes: 40, lessons: 7,
      breaks: [{ after: 2, minutes: 20, name: 'Break' }, { after: 5, minutes: 60, name: 'Lunch' }],
    }))
  })
})

describe('Teacher home', () => {
  it("lists today's lessons", async () => {
    mockApi.current = deepApiMock({
      'teacherHome.get': () => Promise.resolve({
        checklist: { hidden: true, done: 0, total: 0, steps: [] }, classes: [],
        today: [{ id: 1, class_name: '10A', label: 'Mathematics', room_name: 'Lab 1', start_time: '08:00', end_time: '08:40' }],
      }),
    })
    const onNavigate = vi.fn()
    render(<TeacherHome me={{ name: 'Ann' }} onNavigate={onNavigate} onStartTour={() => {}} />)
    expect(await screen.findByText('Your lessons today')).toBeInTheDocument()
    expect(screen.getByText('10A Mathematics')).toBeInTheDocument()
    expect(screen.getByText('08:00–08:40')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Timetable' }))
    expect(onNavigate).toHaveBeenCalledWith('timetable')
  })
})

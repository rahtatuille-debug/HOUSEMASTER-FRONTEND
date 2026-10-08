// Staff cover, and the teacher dashboard's class performance panel.
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

const { default: Cover } = await import('./Cover.jsx')
const { default: ClassPerformance, ordinal } = await import('./ClassPerformance.jsx')

const lesson = { id: 11, class_name: '2 East', label: 'Maths', teacher_name: 'Mr Otieno', why: 'Sick', room_name: 'Lab 1',
  start_time: '08:00', period_name: 'Lesson 1', cover: null,
  free: [{ id: 3, name: 'Ms Wanjiru', lessons_today: 2 }, { id: 4, name: 'Mr Kip', lessons_today: 5 }] }
const day = { date: '2026-10-12', school_day: true, absent: [], lessons: [lesson], covered: 0, total: 1,
  staff: [{ id: 1, name: 'Mr Otieno' }, { id: 3, name: 'Ms Wanjiru' }] }

describe('Cover', () => {
  it('lists lessons needing cover with who is free, and arranges cover', async () => {
    const arrange = vi.fn(() => Promise.resolve({}))
    mockApi.current = deepApiMock({
      'timetable.cover.day': () => Promise.resolve(day),
      'timetable.absences.list': () => Promise.resolve([{ id: 5, teacher_name: 'Mr Otieno', reason_label: 'Sick',
        start_date: '2026-10-12', end_date: '2026-10-12', periods: [], note: '' }]),
      'timetable.periods.list': () => Promise.resolve([]),
      'timetable.cover.arrange': arrange,
    })
    render(<Cover />)
    const select = await screen.findByLabelText('Cover for 2 East Maths at 08:00')
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Choose who covers…', 'Ms Wanjiru (2 lessons today)', 'Mr Kip (5 lessons today)', 'No cover teacher (supervised another way)'])
    expect(screen.getByText('0 of 1 covered')).toBeInTheDocument()
    fireEvent.change(select, { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Note for the cover of 2 East Maths'), { target: { value: 'Worksheet' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(arrange).toHaveBeenCalledWith(expect.objectContaining({ lesson: 11, cover_teacher: 3, note: 'Worksheet' })))
    expect(await screen.findByText('Ms Wanjiru will cover 2 East Maths.')).toBeInTheDocument()
  })

  it('records an absence for part of one day', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    mockApi.current = deepApiMock({
      'timetable.cover.day': () => Promise.resolve({ ...day, lessons: [], total: 0 }),
      'timetable.absences.list': () => Promise.resolve([]),
      'timetable.periods.list': () => Promise.resolve([{ id: 7, name: 'Lesson 1' }, { id: 8, name: 'Lesson 2' }]),
      'timetable.absences.create': create,
    })
    render(<Cover />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record an absence' }))
    fireEvent.change(screen.getByLabelText('Who is away'), { target: { value: '1' } })
    fireEvent.click(screen.getByLabelText('Only some lessons'))
    fireEvent.click(screen.getByLabelText('Lesson 2'))
    fireEvent.click(screen.getByRole('button', { name: 'Record absence' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ teacher: 1, reason: 'sick', periods: [8] })))
  })

  it('says when a day is not a school day', async () => {
    mockApi.current = deepApiMock({
      'timetable.cover.day': () => Promise.resolve({ ...day, school_day: false, lessons: [] }),
      'timetable.absences.list': () => Promise.resolve([]),
      'timetable.periods.list': () => Promise.resolve([]),
    })
    render(<Cover />)
    expect(await screen.findByText(/isn't a school day/)).toBeInTheDocument()
  })
})

describe('My classes\' performance', () => {
  it('shows each class with its position, and subjects on opening it', async () => {
    mockApi.current = deepApiMock({ 'teacherHome.performance': () => Promise.resolve({
      term: 4, term_name: 'Term 1', terms: [{ id: 4, name: 'Term 1' }],
      classes: [{ id: 1, name: '2 East', year_group: 'Form 2', average: 55, year_average: 60, rank: 2, of: 3, students: 30,
        subjects: [{ subject: 'Maths', average: 60, year_average: 58, rank: 1, of: 3, teaches: true },
          { subject: 'English', average: 50, year_average: 62, rank: 3, of: 3, teaches: false }] }],
    }) })
    render(<ClassPerformance onNavigate={() => {}} />)
    expect(await screen.findByText('2nd of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /2 East/ }))
    const maths = screen.getByText('Maths').closest('tr')
    expect(within(maths).getByText('1st of 3')).toHaveClass('rank-top')
    expect(within(screen.getByText('English').closest('tr')).getByText('3rd of 3')).toHaveClass('rank-bottom')
  })

  it('hides itself on an older server, and says when there are no marks', async () => {
    mockApi.current = deepApiMock({ 'teacherHome.performance': () => Promise.reject(new Error('Not found')) })
    const { container } = render(<ClassPerformance onNavigate={() => {}} />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st'])
  })
})

// Boarding: today's picture, roll call, leave and sick bay for house staff;
// parents of boarders ask for leave and see sick bay visits.
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

const { default: Boarding } = await import('./Boarding.jsx')
const { default: TeacherHome } = await import('./TeacherHome.jsx')

const houses = [{ id: 1, name: 'Uhuru House', staff: [3], staff_names: ['Matron Wanjiru'], dorms: [
  { id: 10, name: 'Dorm A', beds: [{ id: 100, name: 'Bed 1', student: 7, student_name: 'Amina K' },
    { id: 101, name: 'Bed 2', student: null, student_name: '' }] }] }]
const boarders = [
  { id: 7, name: 'Amina K', class_name: '2 East', house: 'Uhuru House', dorm: 'Dorm A', bed: 'Bed 1', where: 'in' },
  { id: 8, name: 'Brian K', class_name: '2 East', house: 'Uhuru House', dorm: 'Dorm A', bed: 'Bed 3', where: 'on_leave' },
]
const overview = { houses: 1, boarders: 2, beds_free: 1, on_leave: 1, sick_bay: 0, leave_waiting: 1,
  missing: [{ student: 9, name: 'Cyrus K', house: 'Uhuru House', roll_call: 4, when: 'Night roll call, Sun 04 Oct', note: 'Not in bed' }] }

function staffApi(overrides = {}) {
  return deepApiMock({
    'boarding.houses.list': () => Promise.resolve(houses),
    'boarding.overview': () => Promise.resolve(overview),
    'boarding.boarders': () => Promise.resolve(boarders),
    ...overrides,
  })
}
const tab = (name) => fireEvent.click(screen.getByRole('tab', { name }))

describe('Boarding page', () => {
  it('shows numbers, who is missing and where each boarder is', async () => {
    mockApi.current = staffApi()
    render(<Boarding me={{ role: 'teacher' }} />)
    expect(await screen.findByText('Missing at the last roll call')).toBeInTheDocument()
    expect(screen.getByText(/Cyrus K/)).toBeInTheDocument()
    expect(await screen.findByText('On leave', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByText('1 leave request waiting for a decision')).toBeInTheDocument()
  })

  it('takes a roll call: mark one missing, the rest present, then finish', async () => {
    const roll = { id: 4, house_name: 'Uhuru House', session_label: 'Night', date: '2026-10-05', counts: {}, entries: [
      { student: 7, name: 'Amina K', dorm: 'Dorm A', status: '', note: '' },
      { student: 8, name: 'Brian K', dorm: 'Dorm A', status: 'on_leave', note: '' },
      { student: 9, name: 'Cyrus K', dorm: 'Dorm A', status: '', note: '' }] }
    const mark = vi.fn((id, entries, complete) => Promise.resolve({ ...roll, counts: complete ? { missing: 1 } : {},
      entries: roll.entries.map((e) => ({ ...e, ...(entries.find((x) => x.student === e.student) || {}) })) }))
    mockApi.current = staffApi({ 'boarding.rollCalls.start': vi.fn(() => Promise.resolve(roll)), 'boarding.rollCalls.mark': mark,
      'boarding.rollCalls.list': () => Promise.resolve([]) })
    render(<Boarding me={{ role: 'teacher' }} />)
    await screen.findByText('Missing at the last roll call')
    tab('Roll call')
    fireEvent.change(screen.getByLabelText('Roll call'), { target: { value: 'night' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start roll call' }))
    expect(await screen.findByText(/Uhuru House · Night ·/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Missing' })[2])
    await waitFor(() => expect(mark).toHaveBeenCalledWith(4, [{ student: 9, status: 'missing' }], false))
    fireEvent.click(await screen.findByRole('button', { name: 'Mark the rest present' }))
    await waitFor(() => expect(mark).toHaveBeenLastCalledWith(4, [{ student: 7, status: 'present' }], false))
    fireEvent.click(screen.getByRole('button', { name: 'Finish roll call' }))
    expect(await screen.findByText('Roll call finished: 1 missing.')).toBeInTheDocument()
  })

  it('approves a parent’s leave request with a note', async () => {
    const act = vi.fn(() => Promise.resolve({}))
    mockApi.current = staffApi({ 'boarding.leave.act': act, 'boarding.leave.list': () => Promise.resolve([
      { id: 5, student: 7, student_name: 'Amina K', house: 'Uhuru House', kind: 'weekend', kind_label: 'Weekend',
        leaving_at: '2026-10-09T13:00:00Z', returning_at: '2026-10-11T15:00:00Z', status: 'requested',
        status_label: 'Waiting for a decision', collected_by: 'Mother', reason: '', requested_by_name: 'Pat' }]) })
    render(<Boarding me={{ role: 'teacher' }} />)
    await screen.findByText('Missing at the last roll call')
    tab('Leave')
    fireEvent.change(await screen.findByLabelText("Note for Amina K's parents"), { target: { value: 'Back by 5pm please' } })
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(act).toHaveBeenCalledWith(5, 'approve', 'Back by 5pm please'))
    expect(await screen.findByText(/Approved leave for Amina K/)).toBeInTheDocument()
  })

  it('checks a boarder into sick bay and emails parents', async () => {
    const checkIn = vi.fn(() => Promise.resolve({}))
    mockApi.current = staffApi({ 'boarding.sickBay.checkIn': checkIn, 'boarding.sickBay.list': () => Promise.resolve([]) })
    render(<Boarding me={{ role: 'teacher' }} />)
    await screen.findByText('Missing at the last roll call')
    tab('Sick bay')
    await waitFor(() => expect(screen.getAllByRole('option', { name: /Amina K/ }).length).toBeGreaterThan(0))
    fireEvent.change(screen.getByLabelText('Boarder'), { target: { value: '7' } })
    fireEvent.change(screen.getByLabelText('Why they came'), { target: { value: 'Headache' } })
    fireEvent.change(screen.getByLabelText('Given or done'), { target: { value: 'Paracetamol' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check in' }))
    await waitFor(() => expect(checkIn).toHaveBeenCalledWith({ student: 7, complaint: 'Headache', treatment: 'Paracetamol', tell_parents: true }))
    expect(await screen.findByText('Amina K is checked into sick bay. Parents have been emailed.')).toBeInTheDocument()
  })

  it('puts a student in an empty bed', async () => {
    const assign = vi.fn(() => Promise.resolve({}))
    mockApi.current = staffApi({ 'boarding.assignBed': assign,
      'boarding.students': () => Promise.resolve([{ id: 12, name: 'Dee K', class_name: '2 East', bed: '' }]) })
    render(<Boarding me={{ role: 'teacher' }} />)
    await screen.findByText('Missing at the last roll call')
    tab('Houses and beds')
    fireEvent.click(screen.getByRole('button', { name: 'Put someone here' }))
    fireEvent.change(screen.getByLabelText('Who sleeps in Dorm A Bed 2'), { target: { value: 'Dee' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Dee K · 2 East' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith(101, 12))
    expect(screen.queryByRole('button', { name: 'Add house' })).toBeNull()  // only admins add houses
  })
})

describe('Teacher home', () => {
  it('flags missing boarders for house staff', async () => {
    mockApi.current = deepApiMock({
      'teacherHome.get': () => Promise.resolve({ checklist: { hidden: true, done: 0, total: 0, steps: [] }, classes: [],
        boarding: overview }),
    })
    const onNavigate = vi.fn()
    render(<TeacherHome me={{ name: 'Ann' }} onNavigate={onNavigate} onStartTour={() => {}} />)
    expect(await screen.findByText('Cyrus K')).toBeInTheDocument()
    expect(screen.getByText('1 leave request to decide')).toBeInTheDocument()
  })
})

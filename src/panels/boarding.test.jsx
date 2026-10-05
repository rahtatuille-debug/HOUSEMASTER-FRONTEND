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
  missing: [{ id: 31, student: 9, name: 'Cyrus K', house: 'Uhuru House', roll_call: 4, when: 'Night roll call, Sun 04 Oct', note: 'Not in bed',
    since: '2026-10-04T20:00:00Z' }] }

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
    expect(await screen.findByText('Missing: not found yet')).toBeInTheDocument()
    expect(screen.getByText(/Cyrus K/)).toBeInTheDocument()
    expect(await screen.findByText('On leave', { selector: '.badge' })).toBeInTheDocument()
    expect(screen.getByText('1 leave request waiting for a decision')).toBeInTheDocument()
  })

  it('A-1: a missing boarder stays listed until someone records them found', async () => {
    let missing = overview.missing
    const resolve = vi.fn(() => { missing = []; return Promise.resolve({}) })
    mockApi.current = staffApi({ 'boarding.overview': () => Promise.resolve({ ...overview, missing }),
      'boarding.absences.resolve': resolve })
    render(<Boarding me={{ role: 'teacher' }} />)
    expect(await screen.findByText('Missing: not found yet')).toBeInTheDocument()
    expect(screen.getByText(/missing since/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Record Cyrus K as found' }))
    fireEvent.change(screen.getByLabelText('How was it resolved?'), { target: { value: 'returned' } })
    fireEvent.change(screen.getByLabelText('Note (optional)'), { target: { value: 'Back at 9pm' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(resolve).toHaveBeenCalledWith(31, 'returned', 'Back at 9pm'))
    expect(await screen.findByText('Cyrus K: recorded.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Missing: not found yet')).toBeNull())
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
    await screen.findByText('Missing: not found yet')
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

  it('A-2: an admin amends a finished roll call with a reason; staff cannot', async () => {
    const done = { id: 6, house_name: 'Uhuru House', session_label: 'Night', date: '2026-10-04', completed_at: '2026-10-04T21:00:00Z',
      counts: { missing: 1 }, amendments: [], entries: [
        { student: 7, name: 'Amina K', dorm: 'Dorm A', status: 'missing', note: '' },
        { student: 9, name: 'Cyrus K', dorm: 'Dorm A', status: 'present', note: '' }] }
    const amend = vi.fn(() => Promise.resolve({ ...done, amendments: [{ by: 'Head', at: '2026-10-05T08:00:00Z', reason: 'Was in the library',
      changes: [{ student: 7, before: 'missing', after: 'present' }] }] }))
    mockApi.current = staffApi({ 'boarding.rollCalls.list': () => Promise.resolve([done]),
      'boarding.rollCalls.get': () => Promise.resolve(done), 'boarding.rollCalls.amend': amend })
    const { unmount } = render(<Boarding me={{ role: 'admin' }} />)
    await screen.findByText('Missing: not found yet')
    tab('Roll call')
    fireEvent.click(await screen.findByRole('button', { name: 'Amend Uhuru House Night roll call' }))
    fireEvent.change(await screen.findByLabelText('Amina K'), { target: { value: 'present' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the change' }))
    expect(await screen.findByText('Say why the roll call is being changed.')).toBeInTheDocument()
    expect(amend).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Why is it being changed?'), { target: { value: 'Was in the library' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save the change' }))
    await waitFor(() => expect(amend).toHaveBeenCalledWith(6, [{ student: 7, status: 'present' }], 'Was in the library'))
    expect(await screen.findByText(/Amended by Head/)).toBeInTheDocument()
    unmount()
    render(<Boarding me={{ role: 'teacher' }} />)
    await screen.findByText('Missing: not found yet')
    tab('Roll call')
    await screen.findByText(/Uhuru House · Night ·/)
    expect(screen.queryByRole('button', { name: /^Amend/ })).toBeNull()
  })

  it('A-3: an admin archives a house instead of deleting it, and can bring it back', async () => {
    const archive = vi.fn(() => Promise.resolve({}))
    const unarchive = vi.fn(() => Promise.resolve({}))
    const list = vi.fn((params) => Promise.resolve(params?.archived ? [{ id: 2, name: 'Old House', staff: [], staff_names: [], dorms: [], is_archived: true }] : houses))
    mockApi.current = staffApi({ 'boarding.houses.list': list, 'boarding.houses.archive': archive, 'boarding.houses.unarchive': unarchive })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Boarding me={{ role: 'admin' }} />)
    await screen.findByText('Missing: not found yet')
    tab('Boarding houses and beds')
    fireEvent.click(screen.getByRole('button', { name: 'Archive Uhuru House' }))
    await waitFor(() => expect(archive).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/Uhuru House is archived/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull()
    fireEvent.click(screen.getByText('Archived houses'))
    fireEvent.click(await screen.findByRole('button', { name: 'Bring back Old House' }))
    await waitFor(() => expect(unarchive).toHaveBeenCalledWith(2))
    window.confirm.mockRestore()
  })

  it('A-5: lists boarders who have no bed, so staff can place them', async () => {
    mockApi.current = staffApi({ 'boarding.overview': () => Promise.resolve({ ...overview, unbedded: 1 }),
      'boarding.unbedded': () => Promise.resolve([{ id: 21, name: 'Wanjiku M', class_name: '1 West' }]) })
    render(<Boarding me={{ role: 'teacher' }} />)
    expect(await screen.findByText('Boarders without a bed')).toBeInTheDocument()
    expect(screen.getByText(/Wanjiku M/)).toBeInTheDocument()
    expect(screen.getByText('Without a bed')).toBeInTheDocument()  // the tile
  })

  it('A-5: the student page flags a boarder without a bed, and says nothing otherwise', async () => {
    const { default: BoarderBedFlag } = await import('./BoarderBedFlag.jsx')
    const { container } = render(<BoarderBedFlag boarding={null} />)
    expect(container).toBeEmptyDOMElement()
    render(<BoarderBedFlag boarding={{ boarder_without_bed: true }} />)
    expect(screen.getByText(/is a boarder but has no bed yet/)).toBeInTheDocument()
  })

  it('approves a parent’s leave request with a note', async () => {
    const act = vi.fn(() => Promise.resolve({}))
    mockApi.current = staffApi({ 'boarding.leave.act': act, 'boarding.leave.list': () => Promise.resolve([
      { id: 5, student: 7, student_name: 'Amina K', house: 'Uhuru House', kind: 'weekend', kind_label: 'Weekend',
        leaving_at: '2026-10-09T13:00:00Z', returning_at: '2026-10-11T15:00:00Z', status: 'requested',
        status_label: 'Waiting for a decision', collected_by: 'Mother', reason: '', requested_by_name: 'Pat' }]) })
    render(<Boarding me={{ role: 'teacher' }} />)
    await screen.findByText('Missing: not found yet')
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
    await screen.findByText('Missing: not found yet')
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
    await screen.findByText('Missing: not found yet')
    tab('Boarding houses and beds')
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
    expect(screen.getByText('Missing, not found yet:')).toBeInTheDocument()
    expect(screen.getByText('1 leave request to decide')).toBeInTheDocument()
  })
})

describe('Boarding option in Setup', () => {
  it('admins turn boarding on, and the menu refreshes', async () => {
    const { default: BoardingOptionCard } = await import('./BoardingOptionCard.jsx')
    const update = vi.fn(() => Promise.resolve({ id: 4, has_boarding: true }))
    const onSaved = vi.fn()
    mockApi.current = deepApiMock({ 'schools.update': update })
    render(<BoardingOptionCard school={{ id: 4, has_boarding: false }} me={{ role: 'admin' }} onSaved={onSaved} />)
    fireEvent.click(screen.getByLabelText('Our school has boarders'))
    expect(await screen.findByText(/Boarding is on/)).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith(4, { has_boarding: true })
    expect(onSaved).toHaveBeenCalledWith({ id: 4, has_boarding: true })
  })

  it('is not shown to teachers', async () => {
    const { default: BoardingOptionCard } = await import('./BoardingOptionCard.jsx')
    mockApi.current = deepApiMock()
    render(<BoardingOptionCard school={{ id: 4, has_boarding: false }} me={{ role: 'teacher' }} />)
    expect(screen.queryByLabelText('Our school has boarders')).toBeNull()
  })
})

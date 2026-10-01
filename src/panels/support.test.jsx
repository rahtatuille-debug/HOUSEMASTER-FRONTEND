// Students who need support: HouseMaster suggests, a teacher confirms or
// dismisses, parents see what was confirmed, and labels show in the lists.
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

const { default: Support } = await import('./Support.jsx')
const { default: SupportCard } = await import('./SupportCard.jsx')
const { default: SupportBadge } = await import('./SupportBadge.jsx')
const { default: SupportLimitsCard } = await import('./SupportLimitsCard.jsx')
const { default: TeacherHome } = await import('./TeacherHome.jsx')

const suggestion = {
  student: 7, name: 'Amina Otieno', class_name: '7A',
  reasons: [
    { code: 'low_average', label: 'Average 30% in T2, below the pass mark of 40%' },
    { code: 'poor_attendance', label: 'Attended 60% of days in T2 (below 80%)' },
  ],
}
const concern = {
  id: 3, student: 9, student_name: 'Brian Kip', class_name: '7B', status: 'open',
  reasons: [{ code: 'big_drop', label: 'Average fell 15 points since T1 (80% to 65%)' }],
  note: 'Finding fractions hard.', support_plan: 'Extra maths on Tuesdays.', review_date: '2020-01-01',
  created_by_name: 'Ms Wanjiru', created_at: '2026-09-01T08:00:00Z', parents_notified_at: '2026-09-01T08:00:01Z',
}

function supportApi(overrides = {}) {
  return deepApiMock({
    'support.suggestions': vi.fn(() => Promise.resolve({ term: 2, term_name: 'Term 2', results: [suggestion] })),
    'support.concerns.list': vi.fn(() => Promise.resolve([concern])),
    ...overrides,
  })
}

describe('Needs support page', () => {
  it('lists suggestions with their reasons and the students already marked', async () => {
    mockApi.current = supportApi()
    render(<Support />)
    expect(await screen.findByText('Amina Otieno')).toBeInTheDocument()
    expect(screen.getByText(/Suggested by HouseMaster · Term 2/)).toBeInTheDocument()
    expect(screen.getByText(/below the pass mark of 40%/)).toBeInTheDocument()
    expect(screen.getByText('Brian Kip')).toBeInTheDocument()
    expect(screen.getByText('Review due')).toBeInTheDocument()
    expect(screen.getByText(/Extra maths on Tuesdays/)).toBeInTheDocument()
    expect(mockApi.current.support.concerns.list).toHaveBeenCalledWith({ status: 'open' })
  })

  it('confirming sends the ticked reasons, the note, plan and review date', async () => {
    const create = vi.fn(() => Promise.resolve({ id: 4, parents_emailed: 1, parents_notified_at: null }))
    mockApi.current = supportApi({ 'support.concerns.create': create })
    render(<Support />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    fireEvent.click(screen.getByLabelText(/Attended 60%/)) // the teacher unticks one reason
    fireEvent.change(screen.getByLabelText('Note for parents and staff'), { target: { value: 'Needs help with reading.' } })
    fireEvent.change(screen.getByLabelText('Support plan'), { target: { value: 'Reading club twice a week.' } })
    fireEvent.change(screen.getByLabelText('Review date'), { target: { value: '2026-11-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and tell parents' }))
    expect(await screen.findByText(/Amina Otieno is marked as needing support. Their parents have been emailed/)).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith({
      student: 7, term: 2, reasons: ['low_average'], note: 'Needs help with reading.',
      support_plan: 'Reading club twice a week.', review_date: '2026-11-01',
    })
  })

  it('"Not needed" dismisses the suggestion for the term', async () => {
    const dismiss = vi.fn(() => Promise.resolve({}))
    mockApi.current = supportApi({ 'support.concerns.dismiss': dismiss })
    render(<Support />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not needed' }))
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith(7, 2))
  })

  it('edits the plan and resolves a marked student', async () => {
    const update = vi.fn(() => Promise.resolve({}))
    const resolve = vi.fn(() => Promise.resolve({}))
    mockApi.current = supportApi({ 'support.concerns.update': update, 'support.concerns.resolve': resolve })
    render(<Support />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Support plan'), { target: { value: 'New plan' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(3, {
      note: 'Finding fractions hard.', support_plan: 'New plan', review_date: '2020-01-01',
    }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }))
    fireEvent.change(screen.getByLabelText(/How did it go/), { target: { value: 'Back on track.' } })
    fireEvent.click(screen.getByRole('button', { name: 'No longer needs support' }))
    await waitFor(() => expect(resolve).toHaveBeenCalledWith(3, 'Back on track.'))
  })

  it('marks a student by hand, with no reasons', async () => {
    const create = vi.fn(() => Promise.resolve({ id: 5, parents_emailed: 0, parents_notified_at: null }))
    mockApi.current = supportApi({
      'support.concerns.create': create,
      'students.list': () => Promise.resolve([
        { id: 9, first_name: 'Brian', last_name: 'Kip', is_active: true }, // already marked: not offered
        { id: 11, first_name: 'Chloe', last_name: 'Mwangi', is_active: true },
      ]),
    })
    render(<Support />)
    await screen.findByText('Amina Otieno')
    fireEvent.click(screen.getByRole('button', { name: 'Mark a student' }))
    const select = await screen.findByLabelText('Student')
    await waitFor(() => expect(within(select).getByText('Chloe Mwangi')).toBeInTheDocument())
    expect(within(select).queryByText('Brian Kip')).toBeNull()
    fireEvent.change(select, { target: { value: '11' } })
    fireEvent.change(screen.getByLabelText('Note for parents and staff'), { target: { value: 'Settling in.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Mark and tell parents' }))
    expect(await screen.findByText(/Chloe Mwangi is marked as needing support. Their parents can see it/)).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ student: 11, reasons: [], note: 'Settling in.', review_date: null }))
  })

  it('shows the server error when confirming fails', async () => {
    const create = vi.fn(() => Promise.reject(Object.assign(new Error('Bad request'), {
      data: { student: ['This student is already marked as needing support.'] },
    })))
    mockApi.current = supportApi({ 'support.concerns.create': create })
    render(<Support />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm and tell parents' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already marked')
  })
})

describe('What parents and staff see', () => {
  it("parents see the reasons, note and plan, but not the review date", () => {
    render(<SupportCard concern={{ ...concern, review_date: undefined }} forParents />)
    expect(screen.getByText('Extra support')).toBeInTheDocument()
    expect(screen.getByText(/Average fell 15 points/)).toBeInTheDocument()
    expect(screen.getByText(/Extra maths on Tuesdays/)).toBeInTheDocument()
    expect(screen.queryByText(/Review/)).toBeNull()
  })

  it('labels in the lists', () => {
    const { rerender } = render(<SupportBadge status="open" />)
    expect(screen.getByText('Needs support')).toBeInTheDocument()
    rerender(<SupportBadge status="suggested" />)
    expect(screen.getByText('May need support')).toBeInTheDocument()
    rerender(<SupportBadge status={null} />)
    expect(screen.queryByText(/support/)).toBeNull()
  })

  it("the teacher's home shows suggestions and reviews that are due", async () => {
    const onNavigate = vi.fn()
    mockApi.current = deepApiMock({
      'teacherHome.get': () => Promise.resolve({
        checklist: { hidden: true, done: 0, total: 0, steps: [] }, classes: [],
        support: { suggested: 2, open: 1, due: [{ id: 3, student: 9, student_name: 'Brian Kip', review_date: '2026-10-01' }] },
      }),
    })
    render(<TeacherHome me={{ name: 'Ann' }} onNavigate={onNavigate} onStartTour={() => {}} />)
    expect(await screen.findByText(/2 suggested by HouseMaster to look at · 1 marked as needing support/)).toBeInTheDocument()
    expect(screen.getByText('Reviews due')).toBeInTheDocument()
    expect(screen.getByText('Brian Kip')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onNavigate).toHaveBeenCalledWith('support')
  })
})

describe('Support limits (admins)', () => {
  const school = { id: 4, support_pass_mark: 40, support_drop_points: 10, support_attendance_min: 80 }

  it('saves the three limits', async () => {
    const update = vi.fn(() => Promise.resolve({ ...school, support_pass_mark: 50 }))
    mockApi.current = deepApiMock({ 'schools.update': update })
    render(<SupportLimitsCard school={school} me={{ role: 'admin' }} />)
    fireEvent.change(screen.getByLabelText('Average below (%)'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))
    expect(await screen.findByText(/Saved/)).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith(4, { support_pass_mark: 50, support_drop_points: 10, support_attendance_min: 80 })
  })

  it('refuses numbers out of range, and is hidden from teachers', () => {
    mockApi.current = deepApiMock()
    const { unmount } = render(<SupportLimitsCard school={school} me={{ role: 'admin' }} />)
    fireEvent.change(screen.getByLabelText('Attendance below (%)'), { target: { value: '120' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save limits' }))
    expect(screen.getByText(/whole number from 1 to 100/)).toBeInTheDocument()
    unmount()
    render(<SupportLimitsCard school={school} me={{ role: 'teacher' }} />)
    expect(screen.queryByText('Save limits')).toBeNull()
  })
})

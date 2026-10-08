// Merits on the Behaviour page: give one to a student or a whole class;
// parents see shared merits next to behaviour records.
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

const { default: Discipline } = await import('./Discipline.jsx')
const { ChildBehaviour } = await import('./GuardianStudents.jsx')

const students = [
  { id: 7, first_name: 'Amina', last_name: 'K', school_class: 3, is_active: true },
  { id: 8, first_name: 'Ben', last_name: 'O', school_class: 3, is_active: true },
  { id: 9, first_name: 'Cara', last_name: 'M', school_class: 4, is_active: true },
]
const merit = { id: 5, student: 7, student_name: 'Amina K', class_name: '2 East', date: '2026-10-06', category: 'kindness',
  category_label: 'Kindness and respect', points: 2, reason: 'Helped a new pupil', shared_with_parents: true,
  awarded_by_name: 'Ms Wanjiru', can_edit: true }
const summary = { points: 2, merits: 1, students: 1, top_students: [{ id: 7, name: 'Amina K', class_name: '2 East', points: 2, merits: 1 }],
  classes: [{ id: 3, name: '2 East', points: 2, merits: 1, students: 1 }] }

function setup(overrides = {}) {
  mockApi.current = deepApiMock({
    'discipline.list': () => Promise.resolve([]),
    'discipline.merits.list': () => Promise.resolve([merit]),
    'discipline.merits.summary': () => Promise.resolve(summary),
    'students.list': () => Promise.resolve(students),
    'schoolClasses.list': () => Promise.resolve([{ id: 3, name: '2 East' }, { id: 4, name: '2 West' }]),
    ...overrides,
  })
  render(<Discipline me={{ role: 'teacher' }} />)
  fireEvent.click(screen.getByRole('tab', { name: 'Merits' }))
}

describe('Merits', () => {
  it('lists merits with points, the top students and points by class', async () => {
    setup()
    expect(await screen.findByText('Helped a new pupil')).toBeInTheDocument()
    expect(screen.getByText('Most points')).toBeInTheDocument()
    expect(screen.getByText('Points by class')).toBeInTheDocument()
    expect(screen.getByText(/Given by Ms Wanjiru · Parents can see it/)).toBeInTheDocument()
  })

  it('gives a merit to a whole class plus one more student', async () => {
    const create = vi.fn(() => Promise.resolve({ awarded: 3, merits: [merit, merit, merit] }))
    setup({ 'discipline.merits.create': create })
    fireEvent.click(await screen.findByRole('button', { name: 'Give a merit' }))
    const form = document.querySelector('.merit-form')
    await waitFor(() => expect(within(form).getAllByRole('option', { name: /2 East \(2\)/ }).length).toBe(1))
    fireEvent.change(within(form).getByLabelText('Or a whole class'), { target: { value: '3' } })
    fireEvent.change(within(form).getByLabelText('Add a student'), { target: { value: '9' } })
    expect(within(form).getByText(/3 students chosen/)).toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: 'Remove Ben O' }))
    fireEvent.change(within(form).getByLabelText('What for'), { target: { value: 'effort' } })
    fireEvent.change(within(form).getByLabelText('Points'), { target: { value: '3' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Give merit' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      students: [7, 9], category: 'effort', points: 3, shared_with_parents: true })))
    expect(await screen.findByText('Merit given to 3 students.')).toBeInTheDocument()
  })

  it("can't be given to nobody, and filters by class", async () => {
    const list = vi.fn(() => Promise.resolve([]))
    setup({ 'discipline.merits.list': list })
    fireEvent.click(await screen.findByRole('button', { name: 'Give a merit' }))
    expect(screen.getByRole('button', { name: 'Give merit' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '4' } })
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ school_class: '4' })))
  })
})

describe('Parents', () => {
  it('see merits with the total, then behaviour records', () => {
    render(<ChildBehaviour firstName="Amina" rows={[]} merits={[{ id: 1, date: '2026-10-06', category_label: 'Effort', points: 2, reason: 'Great project' },
      { id: 2, date: '2026-10-05', category_label: 'Sport', points: 1, reason: '' }]} />)
    expect(screen.getByText('Merits · 3 points')).toBeInTheDocument()
    expect(screen.getByText('Great project')).toBeInTheDocument()
    expect(screen.getByText("The school hasn't shared any behaviour records about Amina.")).toBeInTheDocument()
  })
})

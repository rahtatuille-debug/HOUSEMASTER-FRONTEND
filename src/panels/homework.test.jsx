// Homework: teachers set it and record how each student did; parents see it.
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

const { default: Homework, dueText } = await import('./Homework.jsx')
const { default: HomeworkList } = await import('./HomeworkList.jsx')

const choices = [{ school_class: 3, class_name: '2 East', subject: 5, subject_name: 'Maths' }]
const hw = { id: 9, school_class: 3, class_name: '2 East', subject: 5, subject_name: 'Maths', title: 'Fractions worksheet',
  instructions: 'Questions 1-10', link: 'https://example.com/sheet', set_on: '2026-10-06', due_date: '2099-01-01', out_of: 10,
  set_by_name: 'Ms Wanjiru', can_edit: true,
  counts: { students: 2, handed_in: 1, late: 0, missing: 1, excused: 0, done_by_student: 1, not_recorded: 0 } }
const records = { assignment: hw, students: [
  { student: 7, name: 'Amina K', status: '', mark: null, comment: '', done_at: '2026-10-07T10:00:00Z', answer: 'https://docs.example/amina' },
  { student: 8, name: 'Ben O', status: 'missing', mark: null, comment: '', done_at: null, answer: '' }] }

function setup(overrides = {}) {
  mockApi.current = deepApiMock({
    'homework.list': () => Promise.resolve([hw]), 'homework.choices': () => Promise.resolve(choices),
    'homework.records': () => Promise.resolve(records), ...overrides,
  })
  render(<Homework />)
}

describe('Homework (staff)', () => {
  it('lists homework with how many are recorded', async () => {
    setup()
    expect(await screen.findByText('Fractions worksheet')).toBeInTheDocument()
    expect(screen.getByText(/2 of 2 recorded · 1 missing · 1 marked done by students/)).toBeInTheDocument()
  })

  it('sets homework for a class and subject', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    setup({ 'homework.create': create })
    fireEvent.click(await screen.findByRole('button', { name: 'Set homework' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Algebra' } })
    fireEvent.change(screen.getByLabelText('Marked out of (optional)'), { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set homework' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ school_class: 3, subject: 5, title: 'Algebra', out_of: 20 })))
  })

  it('records how each student did, seeing what they handed in', async () => {
    const save = vi.fn(() => Promise.resolve(records))
    setup({ 'homework.saveRecords': save })
    fireEvent.click(await screen.findByRole('button', { name: 'Record Fractions worksheet for 2 East' }))
    expect(await screen.findByText('https://docs.example/amina')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Everyone else handed in' }))
    fireEvent.change(screen.getByLabelText('Mark for Amina K'), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText('Comment for Amina K'), { target: { value: 'Well done' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(9, { records: [
      { student: 7, status: 'handed_in', mark: '9', comment: 'Well done' }, { student: 8, status: 'missing', mark: null, comment: '' }] }))
    expect(await screen.findByText(/Saved how 2 students did/)).toBeInTheDocument()
  })
})

describe('Homework list (parents and students)', () => {
  const items = [
    { id: 1, title: 'Essay', subject: 'English', instructions: '', link: '', set_on: '2026-10-01', due_date: '2026-10-05', out_of: null,
      set_by_name: 'Mr O', overdue: true, status: '', status_label: '', mark: null, comment: '', done_at: null, answer: '' },
    { id: 2, title: 'Fractions', subject: 'Maths', instructions: '', link: '', set_on: '2026-10-01', due_date: '2026-10-03', out_of: 10,
      set_by_name: 'Ms W', overdue: false, status: 'handed_in', status_label: 'Handed in', mark: '8.0', comment: 'Good', done_at: null, answer: '' },
  ]
  it('shows what is to do and what is marked', () => {
    render(<HomeworkList items={items} firstName="Amina" />)
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.queryByText('Fractions')).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Done and marked' }))
    expect(screen.getByText('Handed in · 8/10')).toBeInTheDocument()
    expect(screen.getByText('Good')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as done' })).toBeNull() // parents can't hand in
  })

  it('a student hands in with an answer', async () => {
    const handIn = vi.fn(() => Promise.resolve())
    render(<HomeworkList items={items} onHandIn={handIn} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark as done' }))
    fireEvent.change(screen.getByLabelText('Your answer or a link (optional)'), { target: { value: 'My essay link' } })
    fireEvent.click(screen.getByRole('button', { name: 'Hand in' }))
    await waitFor(() => expect(handIn).toHaveBeenCalledWith(items[0], { done: true, answer: 'My essay link' }))
  })

  it('due text', () => {
    expect(dueText('2026-10-08', '2026-10-08')).toBe('Due today')
    expect(dueText('2026-10-09', '2026-10-08')).toBe('Due tomorrow')
  })
})

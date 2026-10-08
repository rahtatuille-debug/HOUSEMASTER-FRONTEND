// Behaviour (discipline) records: staff record and share; parents see only
// what is shared, never staff notes.
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

const amina = { id: 7, first_name: 'Amina', last_name: 'K', is_active: true }
const record = {
  id: 3, student: 7, student_name: 'Amina K', class_name: '2 East', date: '2026-10-06', category: 'fighting',
  category_label: 'Fighting', severity: 'serious', severity_label: 'Serious', description: 'Pushed a pupil at break.',
  action: 'detention', action_label: 'Detention', action_detail: 'Friday 3pm', staff_notes: 'Watch at lunch',
  shared_with_parents: false, recorded_by_name: 'Ms Wanjiru', can_edit: true,
}

describe('Behaviour page', () => {
  it('lists records with a summary and staff notes, and filters by kind', async () => {
    const list = vi.fn(() => Promise.resolve([record]))
    mockApi.current = deepApiMock({ 'discipline.list': list, 'students.list': () => Promise.resolve([amina]) })
    render(<Discipline me={{ role: 'teacher', name: 'Ms Wanjiru' }} />)
    expect(await screen.findByText('Pushed a pupil at break.')).toBeInTheDocument()
    expect(screen.getByText(/Watch at lunch/)).toBeInTheDocument()
    expect(screen.getByText(/Not shared with parents/)).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ from: expect.any(String) }))
    fireEvent.change(screen.getByLabelText('What kind'), { target: { value: 'bullying' } })
    await waitFor(() => expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'bullying' })))
    // A teacher can't delete; only admins can.
    expect(screen.queryByRole('button', { name: /Delete the record/ })).toBeNull()
  })

  it('records an incident and says when parents were emailed', async () => {
    const create = vi.fn(() => Promise.resolve({ ...record, parents_emailed: 2 }))
    mockApi.current = deepApiMock({ 'discipline.list': () => Promise.resolve([]), 'discipline.create': create,
      'students.list': () => Promise.resolve([amina]) })
    render(<Discipline me={{ role: 'teacher' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Record an incident' }))
    const form = document.querySelector('.discipline-form')
    await waitFor(() => expect(within(form).getAllByRole('option', { name: /Amina K/ }).length).toBe(1))
    fireEvent.change(within(form).getByLabelText('Student'), { target: { value: '7' } })
    fireEvent.change(within(form).getByLabelText('What kind'), { target: { value: 'fighting' } })
    fireEvent.change(within(form).getByLabelText('How serious'), { target: { value: 'serious' } })
    fireEvent.change(within(form).getByLabelText('What happened'), { target: { value: 'Pushed a pupil at break.' } })
    fireEvent.change(within(form).getByLabelText('Action taken'), { target: { value: 'detention' } })
    fireEvent.click(within(form).getByLabelText(/Share with parents/))
    fireEvent.click(within(form).getByRole('button', { name: 'Save record' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      student: 7, category: 'fighting', severity: 'serious', description: 'Pushed a pupil at break.',
      action: 'detention', shared_with_parents: true,
    })))
    expect(await screen.findByText('Recorded for Amina K. 2 parents have been emailed.')).toBeInTheDocument()
  })

  it('shares a record later, and admins can delete', async () => {
    const update = vi.fn(() => Promise.resolve({ ...record, shared_with_parents: true, parents_emailed: 1 }))
    const remove = vi.fn(() => Promise.resolve(null))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi.current = deepApiMock({ 'discipline.list': () => Promise.resolve([record]), 'discipline.update': update,
      'discipline.remove': remove, 'students.list': () => Promise.resolve([amina]) })
    render(<Discipline me={{ role: 'admin' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Share the record for Amina K with parents' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(3, { shared_with_parents: true }))
    expect(await screen.findByText(/1 parent has been emailed/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete the record for Amina K' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith(3))
    confirm.mockRestore()
  })

  it('records someone else made show no edit buttons', async () => {
    mockApi.current = deepApiMock({ 'discipline.list': () => Promise.resolve([{ ...record, can_edit: false }]),
      'students.list': () => Promise.resolve([amina]) })
    render(<Discipline me={{ role: 'teacher' }} />)
    await screen.findByText('Pushed a pupil at break.')
    expect(screen.queryByRole('button', { name: /Edit the record/ })).toBeNull()
  })
})

describe('Parents', () => {
  it('see shared records, and a plain line when there are none', async () => {
    const { ChildBehaviour } = await import('./GuardianStudents.jsx')
    const { rerender } = render(<ChildBehaviour firstName="Amina" rows={[{ id: 3, date: '2026-10-06', severity: 'serious',
      severity_label: 'Serious', category_label: 'Fighting', description: 'Pushed a pupil at break.',
      action_label: 'Detention', action_detail: 'Friday 3pm', recorded_by_name: 'Ms Wanjiru' }]} />)
    expect(screen.getByText('Pushed a pupil at break.')).toBeInTheDocument()
    expect(screen.getByText(/Detention · Friday 3pm/)).toBeInTheDocument()
    expect(screen.queryByText(/Staff notes/)).toBeNull()
    rerender(<ChildBehaviour firstName="Amina" rows={[]} />)
    expect(screen.getByText("The school hasn't shared any behaviour records about Amina.")).toBeInTheDocument()
  })
})

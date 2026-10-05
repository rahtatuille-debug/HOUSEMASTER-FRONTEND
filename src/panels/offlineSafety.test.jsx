import { beforeEach, describe, expect, it, vi } from 'vitest'
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
const { default: Grades } = await import('./Grades.jsx')

const admin = { id: 9, role: 'admin', assignments: [] }
const students = [
  { id: 1, first_name: 'Amina', last_name: 'Otieno' },
  { id: 2, first_name: 'Brian', last_name: 'Kamau' },
]

function register(extra) {
  return deepApiMock({
    'schoolClasses.list': () => Promise.resolve([{ id: 5, name: 'Grade 4' }]),
    'students.list': () => Promise.resolve(students),
    'attendance.list': () => Promise.resolve([]),
    ...extra,
  })
}

function statusButton(name, label) {
  return within(screen.getByRole('group', { name: `Status for ${name}` })).getByRole('button', { name: label })
}

beforeEach(() => {
  localStorage.clear()
})

describe('taking the register on a weak signal', () => {
  it('keeps the students that failed to save, and says how many did save', async () => {
    const created = { student: 1, id: 11, status: 'present', notes: '' }
    let serverRecords = []
    mockApi.current = register({
      'attendance.list': () => Promise.resolve(serverRecords),
      'attendance.create': vi.fn((body) => {
        if (body.student === 1) {
          serverRecords = [created]
          return Promise.resolve(created)
        }
        return Promise.reject(new Error('Could not reach the server. Please try again.'))
      }),
    })
    render(<Attendance me={admin} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save register (2)' }))
    expect(await screen.findByText(/Saved 1 of 2/)).toBeInTheDocument()
    expect(screen.getByText(/1 still to save/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save register (1)' })).toBeEnabled()
  })

  it('does not create a record twice when the first save reached the server but the answer was lost', async () => {
    const saved = { student: 1, id: 11, status: 'present', notes: '' }
    let serverRecords = []
    const create = vi.fn((body) => {
      serverRecords = [saved, { student: 2, id: 12, status: 'present', notes: '' }]
      return Promise.reject(new Error('The connection dropped before the server answered.'))
    })
    const update = vi.fn((id, body) => Promise.resolve({ id, student: id - 10, ...body }))
    mockApi.current = register({
      'attendance.list': () => Promise.resolve(serverRecords),
      'attendance.create': create,
      'attendance.update': update,
    })
    render(<Attendance me={admin} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Save register (2)' }))
    // The screen checks with the server and finds both were in fact saved.
    expect(await screen.findByRole('button', { name: 'All saved' })).toBeDisabled()
    expect(create).toHaveBeenCalledTimes(2)
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps changes that weren’t saved when the app is closed and opened again', async () => {
    mockApi.current = register()
    const first = render(<Attendance me={admin} />)
    fireEvent.click(await waitFor(() => statusButton('Brian Kamau', 'Absent')))
    first.unmount()

    render(<Attendance me={admin} />)
    await waitFor(() => expect(statusButton('Brian Kamau', 'Absent')).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByText(/unsaved change/i)).toBeInTheDocument()
  })

  it('forgets the kept changes once the register is saved', async () => {
    mockApi.current = register({
      'attendance.create': (body) => Promise.resolve({ ...body, id: 10 + body.student }),
    })
    const first = render(<Attendance me={admin} />)
    fireEvent.click(await waitFor(() => statusButton('Brian Kamau', 'Absent')))
    fireEvent.click(screen.getByRole('button', { name: 'Save register (2)' }))
    await screen.findByRole('button', { name: 'All saved' })
    first.unmount()

    render(<Attendance me={admin} />)
    await waitFor(() => expect(statusButton('Brian Kamau', 'Present')).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.queryByText(/unsaved change/i)).toBeNull()
  })
})

describe('G: a register someone else saved while this phone was offline', () => {
  it('does not silently overwrite the other teacher\'s mark with the kept change', async () => {
    let onServer = []
    const update = vi.fn((id, body) => Promise.resolve({ id, student: 2, ...body }))
    mockApi.current = register({ 'attendance.list': () => Promise.resolve(onServer), 'attendance.update': update,
      'attendance.create': (body) => Promise.resolve({ ...body, id: 30 + body.student }) })
    // Offline: Brian marked absent, not saved, app closed.
    const first = render(<Attendance me={admin} />)
    fireEvent.click(await waitFor(() => statusButton('Brian Kamau', 'Absent')))
    first.unmount()
    // Meanwhile another teacher saved the register: Brian late.
    onServer = [{ id: 21, student: 2, status: 'late', notes: 'Bus', date: '2026-10-05' }]
    render(<Attendance me={admin} />)
    await waitFor(() => expect(statusButton('Brian Kamau', 'Late')).toHaveAttribute('aria-pressed', 'true'))
    expect(screen.getByText(/Brian Kamau.*changed by someone else/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Save register/ }))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Save register/ })).toBeNull())
    expect(update).not.toHaveBeenCalled()  // the other teacher's 'late' stays
  })
})

describe('entering a mark on a weak signal', () => {
  const options = () => deepApiMock({
    'students.list': () => Promise.resolve([students[0]]),
    'subjects.list': () => Promise.resolve([{ id: 2, name: 'Maths' }]),
    'terms.list': () => Promise.resolve([{ id: 3, name: 'Term 1' }]),
    'grades.page': () => Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
    'grades.create': () => Promise.reject(new Error('You’re offline, so this was not saved.')),
  })

  it('keeps what was typed when the save fails, and after the app is reopened', async () => {
    mockApi.current = options()
    const first = render(<Grades me={admin} />)
    await screen.findAllByRole('option', { name: 'Amina Otieno' })
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Subject|Learning area/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Term/), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/Score/), { target: { value: '77' } })
    fireEvent.submit(screen.getByLabelText(/Score/).closest('form'))
    expect(await screen.findByText(/offline, so this was not saved/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Score/)).toHaveValue(77)
    first.unmount()

    render(<Grades me={admin} />)
    await screen.findAllByRole('option', { name: 'Amina Otieno' })
    await waitFor(() => expect(screen.getByLabelText(/Score/)).toHaveValue(77))
  })
})

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

describe('taking the register when some saves fail', () => {
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

})

describe('entering a mark when the save fails', () => {
  const options = () => deepApiMock({
    'students.list': () => Promise.resolve([students[0]]),
    'subjects.list': () => Promise.resolve([{ id: 2, name: 'Maths' }]),
    'terms.list': () => Promise.resolve([{ id: 3, name: 'Term 1' }]),
    'grades.page': () => Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
    'grades.create': () => Promise.reject(new Error('Could not reach the server. Please try again.')),
  })

  it('keeps what was typed on screen when the save fails, so it can be sent again', async () => {
    mockApi.current = options()
    const first = render(<Grades me={admin} />)
    await screen.findAllByRole('option', { name: 'Amina Otieno' })
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText(/Subject|Learning area/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/Term/), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText(/Score/), { target: { value: '77' } })
    fireEvent.submit(screen.getByLabelText(/Score/).closest('form'))
    expect(await screen.findByText(/Could not reach the server/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Score/)).toHaveValue(77)
    first.unmount()
  })
})

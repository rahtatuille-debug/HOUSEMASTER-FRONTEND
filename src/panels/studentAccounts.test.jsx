// Staff make student logins and print slips; a student hands in homework from their own view.
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

const { default: StudentAccounts } = await import('./StudentAccounts.jsx')

const rows = [
  { student: 7, name: 'Amina K', class_name: '2 East', school_class: 3, has_account: true, username: 'amina.k4821', active: true, must_change_password: false, last_login: '2026-10-07T10:00:00Z' },
  { student: 8, name: 'Ben O', class_name: '2 East', school_class: 3, has_account: false, username: null, active: false, must_change_password: false, last_login: null },
  { student: 9, name: 'Cara M', class_name: '3 West', school_class: 4, has_account: false, username: null, active: false, must_change_password: false, last_login: null },
]

describe('Student accounts (staff)', () => {
  it('makes accounts for a class and shows the slips once', async () => {
    const create = vi.fn(() => Promise.resolve({ created: [{ ...rows[1], has_account: true, username: 'ben.o1234', password: 'river-tiger-47' }], already: 0 }))
    mockApi.current = deepApiMock({ 'studentAccounts.list': () => Promise.resolve(rows), 'studentAccounts.create': create })
    render(<StudentAccounts me={{ school: { name: 'Alpha' } }} />)
    fireEvent.change(await screen.findByLabelText('Class'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Make accounts for everyone without one (1)' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith([8]))
    const slips = document.querySelector('.sa-slips')
    expect(within(slips).getByText('ben.o1234')).toBeInTheDocument()
    expect(within(slips).getByText('river-tiger-47')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('river-tiger-47')).toBeNull()
  })

  it('makes a big group in batches', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ ...rows[1], student: 100 + i, name: `Kid ${i}` }))
    const create = vi.fn((ids) => Promise.resolve({ created: ids.map((id) => ({ student: id, name: `Kid ${id}`, username: `kid${id}`, password: 'p' })), already: 0 }))
    mockApi.current = deepApiMock({ 'studentAccounts.list': () => Promise.resolve(many), 'studentAccounts.create': create })
    render(<StudentAccounts me={{}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Make accounts for everyone without one (60)' }))
    expect(await screen.findByText('Made 60 accounts.')).toBeInTheDocument()
    expect(create.mock.calls.map((c) => c[0].length)).toEqual([25, 25, 10])
    expect(document.querySelectorAll('.sa-slip')).toHaveLength(60)
  })

  it('gives a new password, turns an account off', async () => {
    const reset = vi.fn(() => Promise.resolve({ ...rows[0], password: 'maple-comet-12' }))
    const disable = vi.fn(() => Promise.resolve({}))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi.current = deepApiMock({ 'studentAccounts.list': () => Promise.resolve(rows), 'studentAccounts.reset': reset, 'studentAccounts.disable': disable })
    render(<StudentAccounts me={{}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'New password for Amina K' }))
    expect(await screen.findByText('maple-comet-12')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Turn off Amina K's account" }))
    await waitFor(() => expect(disable).toHaveBeenCalledWith(7))
    confirm.mockRestore()
  })
})

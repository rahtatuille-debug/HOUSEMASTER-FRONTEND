// Every student dropdown can be searched: Support, Boarding leave and sick
// bay, and leave rules all narrow as you type.
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
const { default: Boarding } = await import('./Boarding.jsx')

const many = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, first_name: `Kid${i + 1}`, last_name: 'Otieno', is_active: true }))
many.push({ id: 40, first_name: 'Imani', last_name: 'Wanjiku', external_id: 'ADM777', is_active: true })
const boarders = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, name: `Boarder${i + 1} K`, house: 'Uhuru House', where: 'in' }))
boarders.push({ id: 40, name: 'Zawadi M', house: 'Simba House', where: 'in', leave_admin_only: true })

function boardingApi(overrides = {}) {
  return deepApiMock({
    'boarding.houses.list': () => Promise.resolve([]),
    'boarding.overview': () => Promise.resolve({ houses: 2, boarders: 11, beds_free: 0, on_leave: 0, sick_bay: 0, leave_waiting: 0, missing: [] }),
    'boarding.boarders': () => Promise.resolve(boarders),
    'boarding.leave.list': () => Promise.resolve([]),
    'boarding.sickBay.list': () => Promise.resolve([]),
    'boarding.restrictions.list': () => Promise.resolve([]),
    ...overrides,
  })
}
const tab = (name) => fireEvent.click(screen.getByRole('tab', { name }))

describe('Student search in every dropdown', () => {
  it('Support: marking a student by hand finds them by admission number', async () => {
    mockApi.current = deepApiMock({
      'support.suggestions': () => Promise.resolve({ term: 2, term_name: 'Term 2', results: [] }),
      'support.concerns.list': () => Promise.resolve([]),
      'students.list': () => Promise.resolve(many),
    })
    render(<Support />)
    fireEvent.click(await screen.findByRole('button', { name: 'Mark a student' }))
    const search = await screen.findByLabelText('Search student')
    fireEvent.change(search, { target: { value: 'adm777' } })
    expect(screen.getByLabelText('Student')).toHaveValue('40')
  })

  it('Boarding leave: searching by name picks the boarder; restricted ones stay flagged', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    mockApi.current = boardingApi({ 'boarding.leave.create': create })
    render(<Boarding me={{ role: 'teacher' }} />)
    tab('Leave')
    fireEvent.click(await screen.findByRole('button', { name: 'Give leave' }))
    await waitFor(() => expect(screen.getByLabelText('Search boarder')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Search boarder'), { target: { value: 'boarder1' } })
    expect(within(screen.getByLabelText('Boarder')).getAllByRole('option')).toHaveLength(3) // Choose…, Boarder1, Boarder10
    fireEvent.change(screen.getByLabelText('Search boarder'), { target: { value: 'zaw' } })
    expect(screen.getByLabelText('Boarder')).toHaveValue('40')
    expect(screen.getByRole('option', { name: 'Zawadi M (Simba House) · admin approval only' })).toBeInTheDocument()
  })

  it('Boarding sick bay: searching by house narrows the list', async () => {
    mockApi.current = boardingApi()
    render(<Boarding me={{ role: 'teacher' }} />)
    tab('Sick bay')
    await waitFor(() => expect(screen.getByLabelText('Search boarder')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Search boarder'), { target: { value: 'simba' } })
    expect(screen.getByLabelText('Boarder')).toHaveValue('40')
  })

  it('Leave rules (admin): the boarder dropdown is searchable too', async () => {
    mockApi.current = boardingApi()
    render(<Boarding me={{ role: 'admin' }} />)
    tab('Leave')
    fireEvent.change(await screen.findByLabelText('Search boarder needing admin approval'), { target: { value: 'boarder7' } })
    expect(screen.getByLabelText('Boarder needing admin approval')).toHaveValue('7')
  })
})

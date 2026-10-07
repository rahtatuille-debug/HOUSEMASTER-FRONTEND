// Allocating boarders to houses, and filling a house's free beds at random.
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
const { default: Boarding } = await import('./Boarding.jsx')

const houses = [
  { id: 1, name: 'Uhuru House', staff: [], staff_names: [], allocated_waiting: 2, beds_free: 3,
    dorms: [{ id: 10, name: 'Dorm A', beds: [{ id: 100, name: 'Bed 1', student: null, student_name: '' }] }] },
  { id: 2, name: 'Tumaini House', staff: [], staff_names: [], allocated_waiting: 0, beds_free: 0, dorms: [] },
]
const rows = [
  { id: 7, name: 'Amina K', admission_number: 'A7', class_name: '2 East', house: 'Uhuru House', house_id: 1, bed: 'Dorm A Bed 1' },
  { id: 8, name: 'Brian K', admission_number: 'A8', class_name: '2 East', house: '', house_id: null, bed: '' },
  { id: 9, name: 'Cyrus K', admission_number: 'A9', class_name: '3 West', house: '', house_id: null, bed: '' },
]
const api = (overrides = {}) => deepApiMock({
  'boarding.houses.list': () => Promise.resolve(houses),
  'boarding.allocations.list': () => Promise.resolve(rows),
  ...overrides,
})
const tab = (name) => fireEvent.click(screen.getByRole('tab', { name }))

describe('House allocation', () => {
  it('an admin picks boarders not yet in a house and allocates them', async () => {
    const allocate = vi.fn(() => Promise.resolve({ allocated: 2 }))
    mockApi.current = api({ 'boarding.allocations.allocate': allocate })
    render(<Boarding me={{ role: 'admin' }} />)
    await waitFor(() => expect(screen.getByRole('tab', { name: 'House allocation' })).toBeInTheDocument())
    tab('House allocation')
    await screen.findByText('Brian K')
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'none' } })
    expect(screen.queryByText('Amina K')).toBeNull()
    fireEvent.click(screen.getByLabelText('Select all shown'))
    fireEvent.change(screen.getByLabelText('Allocate to'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Allocate 2 boarders' }))
    await waitFor(() => expect(allocate).toHaveBeenCalledWith([8, 9], 2))
    expect(await screen.findByText(/2 boarders allocated to Tumaini House/)).toBeInTheDocument()
  })

  it('search narrows the list by name or admission number', async () => {
    mockApi.current = api()
    render(<Boarding me={{ role: 'admin' }} />)
    await waitFor(() => tab('House allocation'))
    await screen.findByText('Brian K')
    fireEvent.change(screen.getByLabelText('Search boarders'), { target: { value: 'a9' } })
    expect(screen.getByText('Cyrus K')).toBeInTheDocument()
    expect(screen.queryByText('Brian K')).toBeNull()
  })

  it('house staff see the list but cannot allocate', async () => {
    mockApi.current = api()
    render(<Boarding me={{ role: 'teacher' }} />)
    await waitFor(() => tab('House allocation'))
    await screen.findByText('Amina K')
    expect(screen.queryByLabelText('Allocate to')).toBeNull()
  })
})

describe('Fill free beds at random', () => {
  it('fills a house\'s free beds with its waiting boarders, after asking', async () => {
    const fill = vi.fn(() => Promise.resolve({ placed: [{ student: 8, name: 'Brian K', bed: 'Dorm A Bed 1' }, { student: 9, name: 'Cyrus K', bed: 'Dorm A Bed 2' }], still_waiting: 0, beds_left: 1 }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi.current = api({ 'boarding.houses.fillBeds': fill })
    render(<Boarding me={{ role: 'teacher' }} />)
    await waitFor(() => tab('Boarding houses and beds'))
    const card = within(screen.getByRole('region', { name: 'Uhuru House' }))
    expect(card.getByText('2 allocated boarders without a bed · 3 free beds')).toBeInTheDocument()
    fireEvent.click(card.getByRole('button', { name: 'Fill free beds at random' }))
    await waitFor(() => expect(fill).toHaveBeenCalledWith(1))
    expect(await screen.findByText(/Placed 2 boarders in Uhuru House: Brian K \(Dorm A Bed 1\), Cyrus K \(Dorm A Bed 2\)/)).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Tumaini House' })).queryByRole('button', { name: 'Fill free beds at random' })).toBeNull()
    confirm.mockRestore()
  })
})

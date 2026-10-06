// A-6: a student's house (sports or pastoral) and a boarding house are different things,
// so every label says which one it means.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Students } = await import('./Students.jsx')
const { default: GuardianStudents } = await import('./GuardianStudents.jsx')
const { default: Boarding } = await import('./Boarding.jsx')

describe('A-6: house labels', () => {
  it('the Students list and form say "Sports house"', async () => {
    const rows = () => Promise.resolve([{ id: 1, first_name: 'Amina', last_name: 'K', house: 'Simba', is_active: true, school_class: null }])
    // students.page once the list is paged by the server (E-1); students.list before.
    mockApi.current = deepApiMock({ 'students.list': rows, 'students.page': rows })
    render(<Students me={{ role: 'admin' }} />)
    expect(await screen.findByRole('columnheader', { name: 'Sports house' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'House' })).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a student' })[0])
    expect(screen.getByLabelText('Sports house')).toBeInTheDocument()
  })

  it('parents see "Sports house", not "<name> House"', async () => {
    mockApi.current = deepApiMock({
      'guardianStudents.list': () => Promise.resolve([{ id: 1, first_name: 'Amina', last_name: 'K', house: 'Simba', school_class_name: '2 East' }]),
    })
    render(<GuardianStudents />)
    expect(await screen.findByText('Sports house: Simba')).toBeInTheDocument()
    expect(screen.queryByText('Simba House')).toBeNull()
  })

  it('boarding screens say "Boarding house"', async () => {
    mockApi.current = deepApiMock({
      'boarding.houses.list': () => Promise.resolve([{ id: 1, name: 'Uhuru', staff: [], staff_names: [], dorms: [] }]),
      'boarding.overview': () => Promise.resolve({ boarders: 1, on_leave: 0, sick_bay: 0, leave_waiting: 0, beds_free: 0, missing: [] }),
      'boarding.boarders': () => Promise.resolve([{ id: 7, name: 'Amina K', class_name: '', house: 'Uhuru', dorm: 'A', bed: '1', where: 'in' }]),
    })
    render(<Boarding me={{ role: 'admin' }} />)
    expect(await screen.findByRole('columnheader', { name: 'Boarding house' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Roll call' }))
    expect(screen.getByLabelText('Boarding house')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Boarding houses and beds' })).toBeInTheDocument()
  })
})

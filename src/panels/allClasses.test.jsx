// Teacher dashboard: every class's average and position, never a student.
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

const { default: AllClasses } = await import('./AllClasses.jsx')

const data = {
  term: 2, term_name: 'Term 2', terms: [{ id: 1, name: 'Term 1' }, { id: 2, name: 'Term 2' }], min_group: 3,
  year_groups: [
    { id: 1, name: 'Form 1', average: 55.0, subjects: ['Maths'], classes: [
      { id: 10, name: '1 East', students: 30, average: 55.0, rank: 1, of: 1, mine: false, subjects: { Maths: 55.0 } }] },
    { id: 2, name: 'Form 2', average: 70.0, subjects: ['English', 'Maths'], classes: [
      { id: 20, name: '2 East', students: 31, average: 60.0, rank: 2, of: 2, mine: true, subjects: { Maths: 60.0, English: null } },
      { id: 21, name: '2 West', students: 29, average: 80.0, rank: 1, of: 2, mine: false, subjects: { Maths: 80.0, English: 71.5 } },
      { id: 22, name: '2 North', students: 2, average: null, rank: null, of: 2, mine: false, subjects: {} }] },
  ],
}

describe('All classes panel', () => {
  it('opens on my year group and shows every class, its position and subject averages', async () => {
    mockApi.current = deepApiMock({ 'teacherHome.allClasses': () => Promise.resolve(data) })
    render(<AllClasses />)
    const table = await screen.findByRole('table', { name: /Form 2/ })
    const rows = within(table).getAllByRole('row').map((r) => r.textContent)
    expect(rows[0]).toBe('ClassStudentsAveragePositionEnglishMaths')
    expect(rows[1]).toBe('2 East · yours3160%2nd of 2—60%')
    expect(rows[2]).toBe('2 West2980%1st of 271.5%80%')
    expect(rows[3]).toBe('2 North2————')
    expect(screen.getByText(/fewer than 3 students have marks/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Form 1' }))
    expect(await screen.findByRole('table', { name: /Form 1/ })).toBeInTheDocument()
  })

  it('changes term, and says when there are no marks', async () => {
    const get = vi.fn((term) => Promise.resolve(term ? { ...data, term: 1, term_name: 'Term 1', year_groups: [] } : data))
    mockApi.current = deepApiMock({ 'teacherHome.allClasses': get })
    render(<AllClasses />)
    fireEvent.change(await screen.findByLabelText('Term'), { target: { value: '1' } })
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('1'))
    expect(await screen.findByText('No marks yet in Term 1.')).toBeInTheDocument()
  })

  it('shows nothing on an older server', async () => {
    mockApi.current = deepApiMock({ 'teacherHome.allClasses': () => Promise.reject(new Error('Not found')) })
    const { container } = render(<AllClasses />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

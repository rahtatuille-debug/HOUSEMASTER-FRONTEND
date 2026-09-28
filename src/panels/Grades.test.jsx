import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Grades } = await import('./Grades.jsx')
const { PAGE } = await import('./ShowMore.jsx')

const students = [{ id: 1, first_name: 'Amina', last_name: 'Otieno' }]
const subjects = [{ id: 2, name: 'Maths' }]
const terms = [{ id: 3, name: 'Term 1' }]

function grade(id) {
  return { id, student: 1, subject: 2, term: 3, score: `${id}.00`, max_score: '100.00', assessment_type: null }
}

function options(extra) {
  return deepApiMock({
    'students.list': () => Promise.resolve(students),
    'subjects.list': () => Promise.resolve(subjects),
    'terms.list': () => Promise.resolve(terms),
    ...extra,
  })
}

describe('grades list paging', () => {
  it('loads marks from the server a page at a time', async () => {
    const total = PAGE + 3
    const page = vi.fn(({ page: n }) => Promise.resolve(n === 1
      ? { count: total, next: '?page=2', previous: null, results: Array.from({ length: PAGE }, (_, i) => grade(i + 1)) }
      : { count: total, next: null, previous: '?page=1', results: [grade(PAGE + 1), grade(PAGE + 2), grade(PAGE + 3)] }))
    mockApi.current = options({ 'grades.page': page })
    render(<Grades me={{ id: 9, role: 'admin', assignments: [] }} />)
    expect(await screen.findByText(`Showing ${PAGE} of ${total} marks`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show 3 more/ }))
    await waitFor(() => expect(page).toHaveBeenCalledTimes(2))
    expect(page.mock.calls[1][0]).toMatchObject({ page: 2, page_size: PAGE })
    expect(await screen.findByText(`Showing ${total} of ${total} marks`)).toBeInTheDocument()
  })

  it('still pages a whole list on screen when the backend sends one', async () => {
    const total = PAGE + 5
    mockApi.current = options({
      'grades.page': () => Promise.resolve(Array.from({ length: total }, (_, i) => grade(i + 1))),
    })
    render(<Grades me={{ id: 9, role: 'admin', assignments: [] }} />)
    expect(await screen.findByText(`Showing ${PAGE} of ${total} marks`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Show 5 more/ }))
    expect(await screen.findByText(`Showing ${total} of ${total} marks`)).toBeInTheDocument()
  })
})

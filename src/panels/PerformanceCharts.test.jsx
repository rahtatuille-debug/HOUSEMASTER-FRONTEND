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

const { default: Performance } = await import('./Performance.jsx')

const terms = [{ id: 4, name: 'T1', is_locked: false }]
const base = { terms, term: 4, trend: [{ term: 'T1' }], subjects: [], grading: { scale: 'pct' } }

describe('the extra charts on the Performance page', () => {
  it('ask for each chart with the scope and id its figures were loaded for', async () => {
    const charts = vi.fn(() => Promise.resolve({ name: 'x', terms: [], subjects: [], points: [], types: [], ranked: false, reason: '' }))
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 1, name: '7A', year_group: 9 }]),
      'yearGroups.list': () => Promise.resolve([{ id: 9, name: 'Year 7' }]),
      'students.list': () => Promise.resolve([{ id: 50, first_name: 'Ann', last_name: 'X' }]),
      performance: ({ scope }) => Promise.resolve(scope === 'class'
        ? { ...base, scope: 'class', name: '7A', year_group_name: 'Year 7', students_count: 1, distribution: [], students: [] }
        : { ...base, scope: 'student', name: 'Ann X' }),
      charts,
    })
    render(<Performance me={{ role: 'admin', permissions: { is_leader: true } }} />)
    await waitFor(() => expect(charts).toHaveBeenCalledWith({ chart: 'subject_trends', scope: 'class', id: '1' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Student' }))
    await waitFor(() => expect(charts).toHaveBeenCalledWith({ chart: 'subject_trends', scope: 'student', id: '50' }))
    // Never a group chart asked for with a student's id while the page switches over.
    const groupWithStudentId = charts.mock.calls.filter(([p]) => p.scope === 'class' && p.id !== '1')
    expect(groupWithStudentId).toEqual([])
  })
})

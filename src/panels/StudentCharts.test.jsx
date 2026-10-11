import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'
import { LineChart } from './charts.jsx'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { SubjectTrends, AssessmentTypes } = await import('./StudentCharts.jsx')

afterEach(() => { try { localStorage.clear() } catch { /* ignore */ } })

const terms = [{ id: 1, name: 'T1' }, { id: 2, name: 'T2' }, { id: 3, name: 'T3' }]
function trends(subjects) {
  return {
    name: 'Ann X', terms, compare: { min_students: 5 },
    subjects: Object.entries(subjects).map(([subject, values]) => ({
      subject, points: values.map(([student, klass], i) => ({ term: terms[i].name, term_id: terms[i].id, student, class: klass ?? null })),
    })),
  }
}

describe('P-1 subject trends', () => {
  it('shows six subjects by default, a gap for a missing term, and the class line only on request', () => {
    const subjects = Object.fromEntries(['Art', 'Biology', 'Chemistry', 'English', 'French', 'Geography', 'History'].map((s, i) => [s, [[50 + i, 60], [null, null], [55 + i, 61]]]))
    subjects.History = [[70, null], [null, null], [null, null]] // fewest terms: left out by default
    const { container } = render(<SubjectTrends data={trends(subjects)} />)
    const boxes = screen.getAllByRole('checkbox').slice(0, 7)
    expect(boxes.filter((b) => b.checked)).toHaveLength(6)
    expect(screen.getByLabelText('History')).not.toBeChecked()
    // Gaps: T2 has no marks, so every subject line is two separate pieces, never joined through T2.
    const lines = [...container.querySelectorAll('path[fill="none"]')]
    expect(lines.every((p) => (p.getAttribute('d').match(/M/g) || []).length === 2)).toBe(true)
    // More than three lines: each has its own marker shape too.
    expect(container.querySelectorAll('svg rect').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[stroke-dasharray]').length).toBe(0)
    fireEvent.click(screen.getByLabelText('Compare with class average'))
    expect(container.querySelectorAll('path[stroke-dasharray="6 4"]').length).toBe(6)
    // The choice is remembered.
    fireEvent.click(screen.getByLabelText('History'))
    expect(JSON.parse(localStorage.getItem('hm.charts.subjects'))).toContain('History')
  })

  it('says when there are not enough terms, and the table still shows what there is', () => {
    render(<SubjectTrends data={trends({ Maths: [[74, null], [null, null], [null, null]] })} />)
    expect(screen.getByText(/Not enough terms yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }))
    const table = screen.getByRole('table')
    expect(within(table).getAllByText('no marks')).toHaveLength(2)
    expect(within(table).getByText(/74\.0%/)).toBeInTheDocument()
  })

  it('never offers a class line when the server gives none (small class, or parents)', () => {
    render(<SubjectTrends data={trends({ Maths: [[74], [80], [90]] })} />)
    expect(screen.queryByLabelText('Compare with class average')).toBeNull()
  })
})

describe('LineChart options', () => {
  it('puts position 1 at the top of a reversed axis', () => {
    const data = [{ term: 'T1', class: 1 }, { term: 'T2', class: 4 }]
    const { container } = render(<LineChart data={data} series={[{ key: 'class', label: 'In class', color: '#000' }]} label="ranks"
      yAxis={{ min: 1, max: 4, reverse: true, ticks: [1, 4], format: String }} />)
    const [first, second] = [...container.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cy')))
    expect(first).toBeLessThan(second)
    expect(first).toBe(16) // the top of the plot
  })

  it('places points by date', () => {
    const data = [{ date: '2026-01-05', v: 50 }, { date: '2026-03-31', v: 60 }]
    const { container } = render(<LineChart data={data} series={[{ key: 'v', label: 'v', color: '#000' }]} label="dates"
      dates={{ start: '2026-01-05', end: '2026-03-31' }} />)
    const xs = [...container.querySelectorAll('circle')].map((c) => Number(c.getAttribute('cx')))
    expect(xs).toEqual([40, 530])
    expect(container.textContent).toContain('Feb')
  })
})

describe('P-2 assessment types', () => {
  it('compares types, notes a large gap, and names the ones without enough marks', async () => {
    mockApi.current = deepApiMock({
      charts: () => Promise.resolve({
        name: 'Ann X', term: { id: 1, name: 'T1' }, subjects: ['English', 'Maths'], weighted: true, types: [
          { id: 1, name: 'Classwork', weight: 40, student: 72, marks: 6, class: 65, reason: '' },
          { id: 2, name: 'Assessment week', weight: 60, student: 60, marks: 4, class: null, reason: '' },
          { id: 3, name: 'Quiz', weight: 5, student: null, marks: 1, class: null, reason: 'Not enough data (1 mark; needs 3)' },
        ],
      }),
    })
    render(<AssessmentTypes studentId={1} termId={1} />)
    expect(await screen.findByText('Averages 12 points lower in Assessment week than in Classwork.')).toBeInTheDocument()
    expect(screen.getByText(/Quiz \(not enough data \(1 mark; needs 3\)\)/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show as table' }))
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('is quietly unavailable against an older server', async () => {
    mockApi.current = deepApiMock({ charts: () => Promise.reject(Object.assign(new Error('Not found'), { status: 404 })) })
    render(<AssessmentTypes studentId={1} termId={1} />)
    expect(await screen.findByText('Not available yet.')).toBeInTheDocument()
  })
})


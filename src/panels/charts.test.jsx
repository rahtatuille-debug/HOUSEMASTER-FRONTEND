// A trend over years of terms labels only some of them, so the labels don't overlap.
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { LineChart } from './charts.jsx'

const terms = (n) => Array.from({ length: n }, (_, i) => ({ term: `Term ${i + 1}`, school: 60 + i }))
const series = [{ key: 'school', label: 'School', color: '#000' }]
const labels = (container) => [...container.querySelectorAll('text.chart-axis')]
  .map((t) => t.textContent).filter((t) => t.startsWith('Term'))

describe('Line chart term labels', () => {
  it('labels every term when there are a few', () => {
    const { container } = render(<LineChart data={terms(4)} series={series} label="Trend" />)
    expect(labels(container)).toEqual(['Term 1', 'Term 2', 'Term 3', 'Term 4'])
  })

  it('labels a few, always including the latest, when there are many', () => {
    const { container } = render(<LineChart data={terms(16)} series={series} label="Trend" />)
    expect(labels(container)).toEqual(['Term 1', 'Term 7', 'Term 16'])
  })
})

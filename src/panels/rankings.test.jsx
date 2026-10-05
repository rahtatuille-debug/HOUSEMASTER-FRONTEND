import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

const { StudentTable } = await import('./Performance.jsx')

function row(name, extra) {
  return {
    id: name.length, name, class_name: '7A', year_group_name: 'Form 3', section: '8-4-4',
    average: null, previous: null, change: null, position: null, of: null, improvement_position: null,
    subjects: {}, subject_positions: {}, subject_of: {}, ...extra,
  }
}

// What the server sends, already ranked (reporting/rankings.py): Ben and Cat tie.
const ranked = [
  row('Ann', { average: 80, change: -5, position: 1, of: 3, improvement_position: 3,
    subjects: { Maths: 80, English: 80 }, subject_positions: { Maths: 2, English: 1 }, subject_of: { Maths: 3, English: 3 } }),
  row('Ben', { average: 70, change: 20, position: 2, of: 3, improvement_position: 1,
    subjects: { Maths: 60, English: 80 }, subject_positions: { Maths: 3, English: 1 }, subject_of: { Maths: 3, English: 3 } }),
  row('Cat', { average: 70, change: 1, position: 2, of: 3, improvement_position: 2,
    subjects: { Maths: 90 }, subject_positions: { Maths: 1 }, subject_of: { Maths: 3 } }),
]

function order() {
  return screen.getAllByRole('row').slice(1).map((tr) => within(tr).getByRole('button').textContent)
}

function positionsShown() {
  return screen.getAllByRole('row').slice(1).map((tr) => tr.cells[0].textContent)
}

describe('student rankings', () => {
  it('shows the positions the server worked out, so tied students share one', () => {
    render(<StudentTable students={ranked} onOpenStudent={() => {}} />)
    expect(order()).toEqual(['Ann', 'Ben', 'Cat'])
    expect(positionsShown()).toEqual(['1', '2', '2'])
  })

  it('ranks by most improved', () => {
    render(<StudentTable students={ranked} onOpenStudent={() => {}} />)
    fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'improved' } })
    expect(order()).toEqual(['Ben', 'Cat', 'Ann'])
    expect(screen.getByRole('heading', { name: /Most improved/ })).toBeInTheDocument()
  })

  it('ranks by one subject, listing only the students who take it', () => {
    render(<StudentTable students={ranked} onOpenStudent={() => {}} />)
    fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'subject:English' } })
    expect(order()).toEqual(['Ann', 'Ben'])
    expect(positionsShown()).toEqual(['1', '1'])
    expect(screen.getByRole('heading', { name: /Top in English/ })).toBeInTheDocument()
  })

  it('offers every subject the group takes', () => {
    render(<StudentTable students={ranked} onOpenStudent={() => {}} />)
    const options = within(screen.getByLabelText('Rank by')).getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['Overall', 'Most improved', 'English', 'Maths'])
  })

  it('shows 8-4-4 mean grades', () => {
    const kcse = [row('Xen', { average: 80, position: 1, of: 1, mean_grade: 'A', mean_points: 12, total_points: 24 })]
    render(<StudentTable students={kcse} onOpenStudent={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'Mean grade' })).toBeInTheDocument()
    expect(screen.getByText('A (12 points)')).toBeInTheDocument()
  })

  it('does not rank CBC learners: alphabetical, no positions, nothing to rank by', () => {
    const cbc = [row('Zed', { average: 90, section: 'CBC' }), row('Amo', { average: 50, section: 'CBC' })]
    render(<StudentTable students={cbc} onOpenStudent={() => {}} />)
    expect(order()).toEqual(['Amo', 'Zed'])
    expect(screen.queryByLabelText('Rank by')).toBeNull()
    expect(screen.queryByRole('columnheader', { name: '#' })).toBeNull()
  })

  it('names the year group and class in the whole-school list', () => {
    render(<StudentTable students={ranked} showClass showYear onOpenStudent={() => {}} />)
    expect(screen.getAllByText('Form 3 · 7A')).toHaveLength(3)
  })

  it('opens a student', () => {
    const open = vi.fn()
    render(<StudentTable students={ranked} onOpenStudent={open} />)
    fireEvent.click(screen.getByRole('button', { name: 'Ben' }))
    expect(open).toHaveBeenCalledWith(3)
  })

  it('D-1: says why a student is not ranked and what each position is based on', () => {
    const students = [...ranked.map((s) => ({ ...s, basis: { subjects: 2, marks: 6, usual_subjects: 2 } })),
      row('Dee', { average: 99, change: null, basis: { subjects: 1, marks: 1, usual_subjects: 2 }, not_ranked: 'incomplete_marks',
        not_ranked_label: 'Not ranked: incomplete marks (1 of 2 subjects)', improvement_note: 'Not in most improved: incomplete marks this term' })]
    render(<StudentTable students={students} onOpenStudent={() => {}} />)
    expect(order()).toEqual(['Ann', 'Ben', 'Cat', 'Dee'])
    expect(screen.getByText('Not ranked: incomplete marks (1 of 2 subjects)')).toBeInTheDocument()
    expect(screen.getAllByRole('row')[1].cells[0]).toHaveAttribute('title', '1 of 3 · based on 2 subjects, 6 marks')
    fireEvent.change(screen.getByLabelText('Rank by'), { target: { value: 'improved' } })
    expect(screen.getByText('Not in most improved: incomplete marks this term')).toBeInTheDocument()
  })
})


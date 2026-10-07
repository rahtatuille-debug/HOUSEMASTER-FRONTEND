// Finding a student in a long list by typing part of a name or admission number.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import StudentSelect from './StudentSelect.jsx'

const students = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, first_name: `Kid${i + 1}`, last_name: 'Otieno', external_id: `ADM${100 + i}` }))
students.push({ id: 50, first_name: 'Imani', last_name: 'Wanjiku', external_id: 'ADM777' })

describe('Student search', () => {
  it('narrows the list as you type, and picks the only match', () => {
    const onChange = vi.fn()
    render(<StudentSelect id="s" label="Filter by student" students={students} value="" onChange={onChange} emptyLabel="All students" />)
    const select = screen.getByLabelText('Filter by student')
    expect(within(select).getAllByRole('option')).toHaveLength(14)
    fireEvent.change(screen.getByLabelText('Search filter by student'), { target: { value: 'kid1' } })
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(
      ['All students', 'Kid1 Otieno (ADM100)', 'Kid10 Otieno (ADM109)', 'Kid11 Otieno (ADM110)', 'Kid12 Otieno (ADM111)'])
    expect(screen.getByText('4 students match')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search filter by student'), { target: { value: 'wanj' } })
    expect(onChange).toHaveBeenCalledWith('50')
  })

  it('finds by admission number, and says when nothing matches', () => {
    const onChange = vi.fn()
    render(<StudentSelect id="s" label="Student" students={students} value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Search student'), { target: { value: 'adm777' } })
    expect(onChange).toHaveBeenCalledWith('50')
    fireEvent.change(screen.getByLabelText('Search student'), { target: { value: 'nobody' } })
    expect(within(screen.getByLabelText('Student')).getByRole('option', { name: 'No students match' })).toBeInTheDocument()
  })

  it('a short list needs no search box', () => {
    render(<StudentSelect id="s" label="Student" students={students.slice(0, 3)} value="" onChange={() => {}} />)
    expect(screen.queryByLabelText('Search student')).toBeNull()
  })
})

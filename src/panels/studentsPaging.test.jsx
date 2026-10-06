// E-1: the Students page asks the server for one page at a time and searches on the server.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Students } = await import('./Students.jsx')

const kid = (n) => ({ id: n, first_name: `Kid${n}`, last_name: 'K', external_id: `ADM${n}`, is_active: true, school_class: null })

describe('E-1: Students list paged by the server', () => {
  it('shows the first page with the total, loads the next on request, and searches on the server', async () => {
    const page = vi.fn((params) => Promise.resolve(params.q
      ? { count: 1, next: null, previous: null, results: [kid(77)] }
      : { count: 120, next: params.page < 3 ? 'next' : null, previous: null,
        results: Array.from({ length: 50 }, (_, i) => kid((params.page - 1) * 50 + i + 1)) }))
    mockApi.current = deepApiMock({ 'students.page': page })
    render(<Students me={{ role: 'admin' }} />)
    expect(await screen.findByText(/Showing 50 of 120/)).toBeInTheDocument()
    expect(page).toHaveBeenCalledWith(expect.objectContaining({ page: 1, is_active: true }))
    fireEvent.click(screen.getByRole('button', { name: /Show 50 more/ }))
    expect(await screen.findByText(/Showing 100 of 120/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Kid77' } })
    await waitFor(() => expect(page).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Kid77', page: 1 })), { timeout: 2000 })
    expect(await screen.findByText('Kid77 K')).toBeInTheDocument()
  })

  it('still filters on screen when an older server sends the whole list', async () => {
    mockApi.current = deepApiMock({ 'students.page': () => Promise.resolve([kid(1), kid(2), kid(3)]) })
    render(<Students me={{ role: 'admin' }} />)
    expect(await screen.findByText('Kid2 K')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'Kid3' } })
    await waitFor(() => expect(screen.queryByText('Kid2 K')).toBeNull(), { timeout: 2000 })
    expect(screen.getByText('Kid3 K')).toBeInTheDocument()
  })
})

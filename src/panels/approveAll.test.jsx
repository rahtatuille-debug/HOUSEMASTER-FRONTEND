// Approve all: every waiting report in a year group or a class, in one go.
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

const { default: ApproveAll } = await import('./ApproveAll.jsx')

const groups = [{ term: 4, term_name: 'Term 1', year_group: 9, year_group_name: 'Form 2', count: 3, blank: 1,
  classes: [{ id: 1, name: '2 East', count: 1, blank: 0 }, { id: 2, name: '2 West', count: 2, blank: 1 }] }]

describe('Approve all', () => {
  it('approves a whole year group and says what stayed waiting', async () => {
    const approveAll = vi.fn(() => Promise.resolve({ count: 2, blank: 1 }))
    const onDone = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi.current = deepApiMock({ 'reports.waiting': () => Promise.resolve(groups), 'reports.approveAll': approveAll })
    render(<ApproveAll onDone={onDone} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Approve all in Form 2, Term 1' }))
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Approve all 2 waiting reports in Form 2 \(Term 1\)/))
    await waitFor(() => expect(approveAll).toHaveBeenCalledWith({ term: 4, year_group: 9 }))
    expect(await screen.findByText(/Approved 2 reports in Form 2\. Parents can now see them\. 1 not finished/)).toBeInTheDocument()
    expect(onDone).toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('or one class, and nothing happens without confirming', async () => {
    const approveAll = vi.fn(() => Promise.resolve({ count: 1, blank: 0 }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    mockApi.current = deepApiMock({ 'reports.waiting': () => Promise.resolve(groups), 'reports.approveAll': approveAll })
    render(<ApproveAll />)
    fireEvent.click(await screen.findByRole('button', { name: 'Show classes in Form 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Approve all in 2 East, Term 1' }))
    expect(approveAll).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Approve all in 2 East, Term 1' }))
    await waitFor(() => expect(approveAll).toHaveBeenCalledWith({ term: 4, school_class: 1 }))
    confirm.mockRestore()
  })

  it('shows nothing when no reports are waiting', async () => {
    mockApi.current = deepApiMock({ 'reports.waiting': () => Promise.resolve([]) })
    const { container } = render(<ApproveAll />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

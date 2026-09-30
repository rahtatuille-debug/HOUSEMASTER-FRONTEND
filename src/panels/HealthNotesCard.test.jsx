import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: HealthNotesCard } = await import('./HealthNotesCard.jsx')
const { default: Approvals } = await import('./Approvals.jsx')

const NEW = 'Peanut allergy: EpiPen in the school bag.'

function request(extra) {
  return { id: 7, medical_notes: NEW, reason: '', status: 'pending', status_label: 'Waiting for approval',
    review_note: '', created_at: '2026-09-30T10:00:00Z', reviewed_at: null, ...extra }
}

beforeEach(() => {
  mockApi.current = deepApiMock()
})

describe('parent: health notes', () => {
  it('shows the notes on file and offers to suggest a change', () => {
    render(<HealthNotesCard studentId={3} notes="Asthma" request={null} onRequestChange={() => {}} />)
    expect(screen.getByText('Asthma')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suggest a change' })).toBeInTheDocument()
  })

  it('sends the suggestion to the school, not straight onto the record', async () => {
    const suggest = vi.fn(() => Promise.resolve(request({ reason: 'New diagnosis' })))
    mockApi.current = deepApiMock({ 'guardianStudents.suggestHealthNotes': suggest })
    const onRequestChange = vi.fn()
    render(<HealthNotesCard studentId={3} notes="Asthma" request={null} onRequestChange={onRequestChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a change' }))
    const box = screen.getByLabelText('Health notes')
    expect(box).toHaveValue('Asthma')
    fireEvent.change(box, { target: { value: NEW } })
    fireEvent.change(screen.getByLabelText(/Anything the school should know/), { target: { value: 'New diagnosis' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to the school' }))
    await waitFor(() => expect(suggest).toHaveBeenCalledWith(3, { medical_notes: NEW, reason: 'New diagnosis' }))
    expect(onRequestChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }))
  })

  it('shows a waiting suggestion, which can be withdrawn', async () => {
    const withdraw = vi.fn(() => Promise.resolve(request({ status: 'cancelled' })))
    mockApi.current = deepApiMock({ 'guardianStudents.withdrawHealthNotes': withdraw })
    const onRequestChange = vi.fn()
    render(<HealthNotesCard studentId={3} notes="Asthma" request={request()} onRequestChange={onRequestChange} />)
    expect(screen.getByText(/Waiting for the school/)).toBeInTheDocument()
    expect(screen.getByText(NEW)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Suggest a change' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(withdraw).toHaveBeenCalledWith(3))
    expect(onRequestChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }))
  })

  it('says when the school declined, with its note', () => {
    render(<HealthNotesCard studentId={3} notes="Asthma"
      request={request({ status: 'rejected', review_note: 'Please bring the doctor’s letter.' })}
      onRequestChange={() => {}} />)
    expect(screen.getByText(/didn’t make your last change/)).toBeInTheDocument()
    expect(screen.getByText(/doctor’s letter/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suggest a change' })).toBeInTheDocument()
  })

  it('keeps what was typed when sending fails', async () => {
    mockApi.current = deepApiMock({
      'guardianStudents.suggestHealthNotes': () => Promise.reject(new Error('You’re offline, so this was not saved.')),
    })
    render(<HealthNotesCard studentId={3} notes="" request={null} onRequestChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Suggest a change' }))
    fireEvent.change(screen.getByLabelText('Health notes'), { target: { value: NEW } })
    fireEvent.click(screen.getByRole('button', { name: 'Send to the school' }))
    expect(await screen.findByText(/offline, so this was not saved/)).toBeInTheDocument()
    expect(screen.getByLabelText('Health notes')).toHaveValue(NEW)
  })
})

describe('admin: approving a parent’s suggestion', () => {
  it('shows the suggested health notes so the admin knows what they approve', async () => {
    const row = {
      id: 7, kind: 'student', operation: 'update', target_id: 3, data: { medical_notes: NEW },
      summary: 'Change health notes for Jaden Afrika (suggested by a parent)', reason: '', status: 'pending',
      status_label: 'Waiting for approval', requested_by: 5, requested_by_name: 'Pat Afrika',
      created_at: '2026-09-30T10:00:00Z', reviewed_by_name: '', reviewed_at: null, review_note: '',
    }
    mockApi.current = deepApiMock({
      'changeRequests.page': () => Promise.resolve({ count: 1, next: null, previous: null, results: [row] }),
      'reports.page': () => Promise.resolve({ count: 0, next: null, previous: null, results: [] }),
    })
    render(<Approvals me={{ id: 1, role: 'admin' }} />)
    expect(await screen.findByText(/Suggested health notes/)).toBeInTheDocument()
    expect(screen.getByText(NEW)).toBeInTheDocument()
  })
})

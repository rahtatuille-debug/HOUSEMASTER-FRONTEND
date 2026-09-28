// B-2: the staff import shows rows deferred by the invite limits, and still
// works with a backend that doesn't send `deferred` yet.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: StaffImportCard } = await import('./StaffImportCard.jsx')

const person = (row) => ({ row, name: `Person ${row}`, email: `p${row}@school.test`, role: 'teacher', assignments: [] })

async function previewWith(result) {
  mockApi.current = deepApiMock({ importStaff: vi.fn(() => Promise.resolve(result)) })
  const { container } = render(<StaffImportCard />)
  const input = container.querySelector('input[type=file]')
  fireEvent.change(input, { target: { files: [new File(['x'], 'staff.xlsx')] } })
  fireEvent.click(screen.getByRole('button', { name: 'Preview import' }))
  await screen.findByText(/will be invited/)
}

describe('staff import: invite limits', () => {
  it('lists deferred rows with the reason and says to run the sheet again later', async () => {
    await previewWith({
      committed: false, people: [person(2), person(3)], skipped: [], errors: [],
      deferred: [{ row: 4, name: 'Person 4', reason: 'You have reached the limit of 100 staff and parent invites per hour.' }],
    })
    expect(screen.getByText(/1 row is over the invite limit/)).toBeInTheDocument()
    expect(screen.getByText('Person 4')).toBeInTheDocument()
    expect(screen.getByText(/limit of 100 staff and parent invites per hour/)).toBeInTheDocument()
    expect(screen.getByText(/import the same sheet again later/i)).toBeInTheDocument()
  })

  it('works with a backend that does not report deferred rows', async () => {
    await previewWith({ committed: false, people: [person(2)], skipped: [], errors: [] })
    expect(screen.getByText(/1 person will be invited/)).toBeInTheDocument()
    expect(screen.queryByText(/invite limit/)).not.toBeInTheDocument()
  })
})

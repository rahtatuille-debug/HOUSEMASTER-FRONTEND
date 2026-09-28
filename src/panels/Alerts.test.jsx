// B-9: urgent alerts are always emailed too, admins can send a test alert
// to staff only, test alerts are marked, and a school's limit is explained.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Alerts } = await import('./Alerts.jsx')

const admin = { id: 1, role: 'admin', assignments: [] }
const sent = { id: 5, title: 'x', recipient_count: 12, acknowledged_count: 0, emailed_at: null, emailed_count: 0,
  email_failed_count: 0, is_active: true, is_test: false }

afterEach(() => vi.restoreAllMocks())

function setup(extra = {}) {
  const create = vi.fn(() => Promise.resolve(sent))
  mockApi.current = deepApiMock({ 'alerts.create': create, ...extra })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  return create
}

describe('Urgent alerts', () => {
  it('always emails as well, with no box to tick', async () => {
    const create = setup()
    render(<Alerts me={admin} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.getByText(/also emailed to everyone it goes to/i)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'School closed' } })
    fireEvent.change(screen.getByLabelText('What people need to know'), { target: { value: 'Burst pipe.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send urgent alert' }))
    expect(await screen.findByText(/sent to 12 people.*being emailed/i)).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ send_email: true, audience: 'everyone' }))
  })

  it('lets admins send a test alert to staff only', async () => {
    const create = setup()
    render(<Alerts me={admin} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send a test alert to staff' }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/test alert to all staff/i))
    expect(await screen.findByText(/test alert sent/i)).toBeInTheDocument()
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ is_test: true, audience: 'all_staff', send_email: true }))
  })

  it('does not offer teachers a test alert', () => {
    setup()
    render(<Alerts me={{ id: 2, role: 'teacher', assignments: [] }} />)
    expect(screen.queryByRole('button', { name: 'Send a test alert to staff' })).not.toBeInTheDocument()
  })

  it("explains when the school's limit is reached", async () => {
    const limited = Object.assign(new Error('Your school has sent as many urgent alerts as it can for now.'), { status: 429 })
    setup({ 'alerts.create': () => Promise.reject(limited) })
    render(<Alerts me={admin} />)
    fireEvent.change(screen.getByLabelText('Headline'), { target: { value: 'Again' } })
    fireEvent.change(screen.getByLabelText('What people need to know'), { target: { value: 'More.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send urgent alert' }))
    expect(await screen.findByText(/as many urgent alerts as it can for now/)).toBeInTheDocument()
  })

  it('marks test alerts in the list', async () => {
    setup({ 'alerts.list': () => Promise.resolve([{ ...sent, id: 9, title: 'Test alert', is_test: true,
      created_by_name: 'Admin', audience_label: 'All staff', created_at: '2026-09-28T08:00:00Z' }]) })
    render(<Alerts me={admin} />)
    expect(await screen.findByText('TEST')).toBeInTheDocument()
  })
})

// F-4: the Approvals, Reports and parents' Communications screens load their
// lists from the server a page at a time, show empty and error states, and
// still work with a backend that sends the whole list.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'
import { PAGE } from './ShowMore.jsx'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Approvals } = await import('./Approvals.jsx')
const { default: GuardianAnnouncements } = await import('./GuardianAnnouncements.jsx')
const { default: Reports } = await import('./Reports.jsx')

const request = (id) => ({ id, summary: `Change ${id}`, status: 'pending', status_label: 'Waiting', requested_by_name: 'T',
  created_at: '2026-09-28T08:00:00Z', operation: 'update' })
const notice = (id) => ({ id, title: `Notice ${id}`, body: 'b', audience: 'all_parents', published_at: '2026-09-28T08:00:00Z' })
const report = (id) => ({ id, student: 1, term: 1, status: 'draft', report_comment: 'Good', generated_at: '2026-09-28T08:00:00Z' })

// A paged endpoint with `total` rows made by `make`.
function paged(total, make) {
  return vi.fn(({ page = 1, page_size: size = PAGE }) => {
    const start = (page - 1) * size
    const results = Array.from({ length: Math.max(0, Math.min(size, total - start)) }, (_, i) => make(start + i + 1))
    return Promise.resolve({ count: total, next: start + size < total ? `?page=${page + 1}` : null, previous: null, results })
  })
}

describe('Approvals', () => {
  const admin = { id: 9, role: 'admin' }

  it('pages the teachers\' requests and the reports waiting', async () => {
    const requests = paged(PAGE + 7, request)
    const reports = paged(3, report)
    mockApi.current = deepApiMock({ 'changeRequests.page': requests, 'reports.page': reports })
    render(<Approvals me={admin} />)
    expect(await screen.findByText(`Change ${PAGE}`)).toBeInTheDocument()
    expect(screen.queryByText(`Change ${PAGE + 1}`)).not.toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Showing ${PAGE} of ${PAGE + 7} requests`))).toBeInTheDocument()
    expect(requests).toHaveBeenCalledWith({ status: 'pending', page: 1, page_size: PAGE })
    expect(reports).toHaveBeenCalledWith({ status: 'submitted', page: 1, page_size: PAGE })
    fireEvent.click(screen.getByRole('button', { name: 'Show 7 more' }))
    expect(await screen.findByText(`Change ${PAGE + 7}`)).toBeInTheDocument()
    expect(requests).toHaveBeenLastCalledWith({ status: 'pending', page: 2, page_size: PAGE })
  })

  it('shows the empty states', async () => {
    mockApi.current = deepApiMock({ 'changeRequests.page': paged(0, request), 'reports.page': paged(0, report) })
    render(<Approvals me={admin} />)
    expect(await screen.findByText('Nothing here.')).toBeInTheDocument()
    expect(screen.getByText('No reports are waiting.')).toBeInTheDocument()
  })

  it('shows a load error', async () => {
    mockApi.current = deepApiMock({ 'changeRequests.page': () => Promise.reject(new Error('Could not load requests.')),
      'reports.page': paged(0, report) })
    render(<Approvals me={admin} />)
    expect(await screen.findByText('Could not load requests.')).toBeInTheDocument()
  })

  it('works with a backend that sends the whole list', async () => {
    const all = Array.from({ length: PAGE + 2 }, (_, i) => request(i + 1))
    mockApi.current = deepApiMock({ 'changeRequests.page': () => Promise.resolve(all), 'reports.page': () => Promise.resolve([]) })
    render(<Approvals me={admin} />)
    expect(await screen.findByText(`Change ${PAGE}`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 more' }))
    expect(screen.getByText(`Change ${PAGE + 2}`)).toBeInTheDocument()
  })

  it('teachers only load their own requests, never the reports list', async () => {
    const reports = vi.fn()
    mockApi.current = deepApiMock({ 'changeRequests.page': paged(2, request), 'reports.page': reports })
    render(<Approvals me={{ id: 3, role: 'teacher' }} />)
    expect(await screen.findByText('Change 2')).toBeInTheDocument()
    expect(reports).not.toHaveBeenCalled()
  })
})

describe('parents\' Communications', () => {
  it('pages announcements and shows the empty and error states', async () => {
    const pages = paged(PAGE + 1, notice)
    mockApi.current = deepApiMock({ 'announcements.page': pages })
    const view = render(<GuardianAnnouncements />)
    expect(await view.findByText(`Notice ${PAGE}`)).toBeInTheDocument()
    fireEvent.click(view.getByRole('button', { name: 'Show 1 more' }))
    expect(await view.findByText(`Notice ${PAGE + 1}`)).toBeInTheDocument()
    view.unmount()

    mockApi.current = deepApiMock({ 'announcements.page': paged(0, notice) })
    const empty = render(<GuardianAnnouncements />)
    expect(await empty.findByText('No school announcements for you yet.')).toBeInTheDocument()
    empty.unmount()

    const denied = Object.assign(new Error('Forbidden'), { status: 403 })
    mockApi.current = deepApiMock({ 'announcements.page': () => Promise.reject(denied) })
    render(<GuardianAnnouncements />)
    expect(await screen.findByText('You do not have access to school announcements.')).toBeInTheDocument()
  })
})

describe('Reports', () => {
  it('asks the server for one page of the chosen status', async () => {
    const pages = paged(PAGE + 5, report)
    mockApi.current = deepApiMock({ 'reports.page': pages })
    render(<Reports me={{ id: 1, role: 'admin', school: { report_extras: [] } }} />)
    await waitFor(() => expect(pages).toHaveBeenCalledWith({ page: 1, page_size: PAGE }))
    expect(await screen.findByText(new RegExp(`Showing ${PAGE} of ${PAGE + 5} reports`))).toBeInTheDocument()
  })
})

// The school calendar: a month of events, term dates and fixtures; managers
// add events; anyone can get a link for their calendar app.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Calendar, whenText } = await import('./Calendar.jsx')

const now = new Date()
const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const day = (d) => `${ym}-${String(d).padStart(2, '0')}`
const items = [
  { id: 'event-1', event: 1, type: 'event', title: 'Sports day', kind: 'sport', kind_label: 'Sport', start_date: day(10), end_date: null,
    start_time: '09:00:00', end_time: '15:00:00', location: 'Main field', description: '', year_groups: [], year_group_ids: [], staff_only: false, can_edit: true },
  { id: 'event-2', event: 2, type: 'event', title: 'Half term', kind: 'holiday', kind_label: 'Holiday or school closed', start_date: day(20), end_date: day(22),
    start_time: null, end_time: null, location: '', description: '', year_groups: ['Form 2'], year_group_ids: [3], staff_only: false, can_edit: true },
  { id: 'fixture-5', type: 'fixture', title: 'Football v Hill', kind: 'fixture', kind_label: 'Fixture', start_date: day(12), end_date: null,
    start_time: '14:00:00', end_time: null, location: 'Away', description: '', year_groups: [], staff_only: false, can_edit: false, picked: ['Amina'] },
]

function setup(overrides = {}, can_manage = true) {
  const get = vi.fn(() => Promise.resolve({ today: day(8), items, can_manage, year_groups: [{ id: 3, name: 'Form 2' }, { id: 4, name: 'Form 3' }] }))
  mockApi.current = deepApiMock({ 'calendar.get': get, ...overrides })
  render(<Calendar />)
  return get
}

describe('Calendar', () => {
  it('shows the month with events on each day they cover', async () => {
    const get = setup()
    expect(await screen.findByRole('gridcell', { name: /Sports day/ })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell', { name: /Half term/ })).toHaveLength(3) // 20th to 22nd
    expect(get).toHaveBeenCalledWith(expect.objectContaining({ from: expect.any(String), to: expect.any(String) }))
    expect(screen.getByText('Amina is in the squad')).toBeInTheDocument()
    expect(screen.getByText('For Form 2')).toBeInTheDocument()
  })

  it('picking a day lists just that day', async () => {
    setup()
    fireEvent.click(await screen.findByRole('gridcell', { name: /Sports day/ }))
    const list = document.querySelector('.cal-list')
    expect(within(list).getByText('Sports day')).toBeInTheDocument()
    expect(within(list).queryByText('Half term')).toBeNull()
  })

  it('a manager adds an event for chosen year groups', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    setup({ 'calendar.events.create': create })
    fireEvent.click(await screen.findByRole('button', { name: 'Add an event' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Science trip' } })
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'trip' } })
    fireEvent.click(screen.getByLabelText('Chosen year groups'))
    expect(screen.getByRole('button', { name: 'Add to calendar' })).toBeDisabled()
    fireEvent.click(screen.getByLabelText('Form 3'))
    fireEvent.click(screen.getByRole('button', { name: 'Add to calendar' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Science trip', kind: 'trip', year_groups: [4], staff_only: false, start_time: null })))
    expect(await screen.findByText('Science trip was added to the calendar.')).toBeInTheDocument()
  })

  it('parents and teachers see no add or change buttons', async () => {
    setup({}, false)
    await screen.findAllByRole('gridcell', { name: /Half term/ })
    expect(screen.queryByRole('button', { name: 'Add an event' })).toBeNull()
  })

  it('gives a private link for calendar apps', async () => {
    setup({ 'calendar.feed': () => Promise.resolve({ url: 'https://x/api/calendar/ical/abc.ics', webcal: 'webcal://x/api/calendar/ical/abc.ics' }) })
    fireEvent.click(await screen.findByRole('button', { name: "Add to my phone's calendar" }))
    expect(await screen.findByLabelText('Calendar link')).toHaveValue('https://x/api/calendar/ical/abc.ics')
    expect(screen.getByRole('link', { name: 'Subscribe' })).toHaveAttribute('href', 'webcal://x/api/calendar/ical/abc.ics')
  })

  it('describes when', () => {
    expect(whenText(items[0])).toBe('09:00–15:00')
    expect(whenText({ type: 'event', start_date: '2026-10-20', end_date: '2026-10-20' })).toBe('All day')
  })
})

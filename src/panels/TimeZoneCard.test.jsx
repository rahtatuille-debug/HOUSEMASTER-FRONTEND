// F-5: admins choose the school's time zone; it decides when the school's
// day starts ("today" for registers and dates).
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

const { default: TimeZoneCard, timeZoneOptions } = await import('./TimeZoneCard.jsx')

const school = { id: 4, name: 'Alpha', timezone: 'Africa/Nairobi' }
const admin = { id: 1, role: 'admin' }

afterEach(() => vi.unstubAllGlobals())

describe('School time zone', () => {
  it("shows the school's current zone and what it affects", () => {
    mockApi.current = deepApiMock()
    render(<TimeZoneCard school={school} me={admin} />)
    expect(screen.getByLabelText('School time zone')).toHaveValue('Africa/Nairobi')
    expect(screen.getByText(/decides when the school's day starts/i)).toBeInTheDocument()
  })

  it('saves a new zone through the school settings', async () => {
    const update = vi.fn(() => Promise.resolve({ ...school, timezone: 'Europe/London' }))
    const onSaved = vi.fn()
    mockApi.current = deepApiMock({ 'schools.update': update })
    render(<TimeZoneCard school={school} me={admin} onSaved={onSaved} />)
    fireEvent.change(screen.getByLabelText('School time zone'), { target: { value: 'Europe/London' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }))
    expect(await screen.findByText('Time zone saved.')).toBeInTheDocument()
    expect(update).toHaveBeenCalledWith(4, { timezone: 'Europe/London' })
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'Europe/London' }))
  })

  it("shows the API's validation error", async () => {
    const refused = Object.assign(new Error('Bad request'), {
      status: 400, data: { timezone: ['Choose a time zone from the list, e.g. "Africa/Nairobi".'] } })
    mockApi.current = deepApiMock({ 'schools.update': () => Promise.reject(refused) })
    render(<TimeZoneCard school={school} me={admin} />)
    fireEvent.change(screen.getByLabelText('School time zone'), { target: { value: 'Europe/London' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }))
    expect(await screen.findByText(/Choose a time zone from the list/)).toBeInTheDocument()
  })

  it('does not send a name that is not a time zone', () => {
    const update = vi.fn()
    mockApi.current = deepApiMock({ 'schools.update': update })
    render(<TimeZoneCard school={school} me={admin} />)
    fireEvent.change(screen.getByLabelText('School time zone'), { target: { value: 'Nairobi-ish' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }))
    expect(screen.getByText(/Pick a time zone from the list/)).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })

  it('is hidden from teachers', () => {
    mockApi.current = deepApiMock()
    const { container } = render(<TimeZoneCard school={school} me={{ id: 2, role: 'teacher' }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers every zone the browser knows, or a short list where it knows none', () => {
    expect(timeZoneOptions('Africa/Nairobi')).toContain('America/New_York')
    vi.stubGlobal('Intl', { ...Intl, supportedValuesOf: undefined })
    const fallback = timeZoneOptions('Pacific/Chatham')
    expect(fallback).toContain('Africa/Nairobi')
    expect(fallback).toContain('Europe/London')
    expect(fallback).toContain('Pacific/Chatham')
  })
})

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

const { default: StaffJoinCard } = await import('./StaffJoinCard.jsx')
const { default: StaffJoin } = await import('./StaffJoin.jsx')

const waiting = [
  { id: 1, name: 'Grace Wanjiru', email: 'grace@alpha.example', phone: '+254 700 000 001', note: 'I teach Year 8 Maths',
    created_at: '2026-10-10T08:00:00Z', has_account: false },
  { id: 2, name: 'Tom Otieno', email: 'tom@alpha.example', phone: '', note: '', created_at: '2026-10-10T09:00:00Z', has_account: true },
]

describe('the staff sign-up link (admin)', () => {
  it('turns the link on, shows it, and approves who is waiting', async () => {
    const change = vi.fn(() => Promise.resolve({ token: 'tok123', waiting: 2 }))
    const decide = vi.fn(() => Promise.resolve({ done: ['Emailed Grace Wanjiru a link to choose their password.'], problems: [], requests: [waiting[1]] }))
    const onChanged = vi.fn()
    mockApi.current = deepApiMock({
      'staffJoin.link': () => Promise.resolve({ token: null, waiting: 2 }),
      'staffJoin.requests': () => Promise.resolve(waiting),
      'staffJoin.change': change,
      'staffJoin.decide': decide,
    })
    render(<StaffJoinCard schoolName="Alpha" onChanged={onChanged} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Make a staff sign-up link' }))
    await waitFor(() => expect(change).toHaveBeenCalledWith('create'))
    expect(await screen.findByText(`${window.location.origin}/staff-join/tok123`)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'WhatsApp' }).getAttribute('href')).toContain(encodeURIComponent('/staff-join/tok123'))

    expect(screen.getByText('“I teach Year 8 Maths”')).toBeInTheDocument()
    expect(screen.getByText('This email already has an account.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve Tom Otieno' })).toBeDisabled()
    // "Approve all" leaves out the one that already has an account.
    fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith([1], 'approve'))
    expect(await screen.findByText(/Emailed Grace Wanjiru/)).toBeInTheDocument()
    expect(onChanged).toHaveBeenCalled()
    expect(screen.queryByText('Grace Wanjiru')).toBeNull()
  })

  it('turns down one request', async () => {
    const decide = vi.fn(() => Promise.resolve({ done: ['Turned down Grace Wanjiru.'], problems: [], requests: [] }))
    mockApi.current = deepApiMock({
      'staffJoin.link': () => Promise.resolve({ token: 'tok123', waiting: 1 }),
      'staffJoin.requests': () => Promise.resolve([waiting[0]]),
      'staffJoin.decide': decide,
    })
    render(<StaffJoinCard />)
    fireEvent.click(await screen.findByRole('button', { name: 'Turn down Grace Wanjiru' }))
    await waitFor(() => expect(decide).toHaveBeenCalledWith([1], 'reject'))
  })
})

describe('the staff sign-up page (public)', () => {
  it('asks to join once the privacy notice is accepted', async () => {
    const ask = vi.fn(() => Promise.resolve({ detail: 'Thank you. An admin at Alpha will check your details.' }))
    mockApi.current = deepApiMock({
      staffJoinInfo: () => Promise.resolve({ school_name: 'Alpha Academy', privacy_contact: '', country: null }),
      staffJoinAsk: ask,
    })
    render(<StaffJoin token="tok123" onSignIn={() => {}} />)
    expect(await screen.findByText('Alpha Academy')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your full name'), { target: { value: 'Grace Wanjiru' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'grace@alpha.example' } })
    fireEvent.change(screen.getByLabelText('What do you teach? (optional)'), { target: { value: 'Maths' } })
    const send = screen.getByRole('button', { name: 'Ask to join' })
    expect(send).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(send)
    await waitFor(() => expect(ask).toHaveBeenCalledWith('tok123', {
      name: 'Grace Wanjiru', email: 'grace@alpha.example', phone: '', note: 'Maths', accept_privacy: true }))
    expect(await screen.findByText(/An admin at Alpha will check/)).toBeInTheDocument()
  })

  it('says so when the link is off', async () => {
    mockApi.current = deepApiMock({ staffJoinInfo: () => Promise.reject(new Error("This sign-up link isn't working any more.")) })
    render(<StaffJoin token="old" onSignIn={() => {}} />)
    expect(await screen.findByText(/isn't working any more/)).toBeInTheDocument()
  })
})

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

const { default: Settings } = await import('./Settings.jsx')

const school = { id: 1, name: 'Alpha Academy', privacy_contact: 'office@alpha.example' }
const teacher = { id: 2, name: 'Tom Otieno', title: '', role: 'teacher', email: 'tom@alpha.example', phone: '', emergency_contact_name: '',
  emergency_contact_phone: '', email_notifications: true, school }

describe('Settings', () => {
  it('a teacher keeps their title, phone and emergency contact up to date', async () => {
    const updateMe = vi.fn((body) => Promise.resolve({ ...teacher, ...body }))
    const onUserUpdated = vi.fn()
    mockApi.current = deepApiMock({ updateMe })
    render(<Settings me={teacher} identityKind="staff" onUserUpdated={onUserUpdated} settingsPages={[]} onNavigate={() => {}} />)
    expect(screen.queryByText(/tom@alpha.example/)).toBeNull() // emails are for signing in, never shown
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Mr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ name: 'Tom Otieno', title: 'Mr' }))
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+254 712 345 678' } })
    fireEvent.change(screen.getByLabelText('Emergency contact'), { target: { value: 'Jane Otieno' } })
    fireEvent.change(screen.getByLabelText("Emergency contact's phone"), { target: { value: '+254 722 000 111' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save contact info' }))
    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({
      phone: '+254 712 345 678', emergency_contact_name: 'Jane Otieno', emergency_contact_phone: '+254 722 000 111' }))
    expect(await screen.findByText('Your contact details have been saved.')).toBeInTheDocument()
    expect(onUserUpdated).toHaveBeenCalled()
    fireEvent.click(screen.getByLabelText(/Email me when a parent reports an absence/))
    await waitFor(() => expect(updateMe).toHaveBeenCalledWith({ email_notifications: false }))
  })

  it('shows what the server says is wrong', async () => {
    const err = Object.assign(new Error('Bad'), { data: { phone: ['Enter a phone number with its country code.'] } })
    mockApi.current = deepApiMock({ updateMe: () => Promise.reject(err) })
    render(<Settings me={teacher} identityKind="staff" settingsPages={[]} onNavigate={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Save contact info' }))
    expect(await screen.findByText('Enter a phone number with its country code.')).toBeInTheDocument()
  })

  it('changes the password, and signs out other devices', async () => {
    const changePassword = vi.fn(() => Promise.resolve({ access: 'a', refresh: 'r' }))
    const signOutOtherDevices = vi.fn(() => Promise.resolve({ access: 'a', refresh: 'r' }))
    mockApi.current = deepApiMock({ changePassword, signOutOtherDevices })
    render(<Settings me={teacher} identityKind="staff" settingsPages={[]} onNavigate={() => {}} />)
    const card = within(screen.getByRole('heading', { name: 'Password and security' }).closest('.card'))
    fireEvent.change(card.getByLabelText('Current password'), { target: { value: 'old-password-1' } })
    fireEvent.change(card.getByLabelText('New password'), { target: { value: 'new-password-22' } })
    fireEvent.change(card.getByLabelText('New password again'), { target: { value: 'new-password-23' } })
    fireEvent.click(card.getByRole('button', { name: 'Change password' }))
    expect(await card.findByText("The new passwords don't match.")).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
    fireEvent.change(card.getByLabelText('New password again'), { target: { value: 'new-password-22' } })
    fireEvent.click(card.getByRole('button', { name: 'Change password' }))
    await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ current_password: 'old-password-1', new_password: 'new-password-22' }))
    expect(await card.findByText(/Your password was changed/)).toBeInTheDocument()
    expect(card.getByLabelText('Current password')).toHaveValue('')
    fireEvent.click(card.getByRole('button', { name: 'Sign out other devices' }))
    expect(await card.findByText('Signed out of every other phone and computer.')).toBeInTheDocument()
  })

  it('an admin also gets the school pages; logging out works', async () => {
    mockApi.current = deepApiMock({})
    const onNavigate = vi.fn()
    const onLogout = vi.fn()
    render(<Settings me={{ ...teacher, role: 'admin' }} identityKind="staff" onNavigate={onNavigate} onLogout={onLogout} onStartTour={() => {}}
      settingsPages={[{ key: 'setup', label: 'Setup' }, { key: 'billing', label: 'Billing' }, { key: 'guide', label: 'Guide' }]} />)
    expect(screen.getByRole('heading', { name: 'Your school' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Setup/ }))
    expect(onNavigate).toHaveBeenCalledWith('setup')
    expect(screen.getByRole('button', { name: /^Take the tour/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    expect(onLogout).toHaveBeenCalled()
  })
})

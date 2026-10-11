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

const { default: Messages } = await import('./Messages.jsx')

describe('message ownership', () => {
  it('puts my own messages on the right and everyone else\'s on the left', async () => {
    const conversation = {
      id: 3, kind: 'direct', participants: [{ id: 5, name: 'Grace', kind: 'guardian' }, { id: 9, name: 'Mr Otieno', kind: 'staff' }],
      member_count: 2, can_reply: true, unread_count: 0, last_message: { body: 'Thanks' }, student_name: null,
    }
    mockApi.current = deepApiMock({
      'conversations.list': () => Promise.resolve([conversation]),
      'conversations.messages': () => Promise.resolve([
        { id: 1, sender: 5, sender_name: 'Grace', body: 'Hello from me', created_at: '2026-09-28T08:00:00Z' },
        { id: 2, sender: 9, sender_name: 'Mr Otieno', body: 'Reply from the teacher', created_at: '2026-09-28T08:05:00Z' },
      ]),
    })
    render(<Messages me={{ id: 5, name: 'Grace' }} identityKind="guardian" />)
    fireEvent.click(await screen.findByText('Thanks'))
    const mine = (await screen.findByText('Hello from me')).parentElement
    const theirs = (await screen.findByText('Reply from the teacher')).parentElement
    expect(mine.style.alignSelf).toBe('flex-end')
    expect(theirs.style.alignSelf).toBe('flex-start')
  })
})

describe('a teacher writing to a parent', () => {
  it('can only name that parent\'s own children, with no student search', async () => {
    const create = vi.fn(() => Promise.resolve({ id: 9, participants: [], kind: 'direct' }))
    const studentsList = vi.fn(() => Promise.resolve([]))
    mockApi.current = deepApiMock({
      'conversations.list': () => Promise.resolve([]),
      'conversations.contacts': () => Promise.resolve([
        { id: 5, name: 'Grace Otieno', kind: 'guardian', children: [{ id: 7, name: 'Amina Otieno' }] },
        { id: 6, name: 'Peter Kamau', kind: 'guardian', children: [{ id: 8, name: 'Brian Kamau' }, { id: 10, name: 'Cate Kamau' }] },
      ]),
      'conversations.create': create,
      'conversations.messages': () => Promise.resolve([]),
      'students.list': studentsList,
    })
    render(<Messages me={{ id: 1, name: 'Mr Otieno' }} identityKind="staff" />)
    fireEvent.click(await screen.findByRole('button', { name: 'New message' }))
    const to = await screen.findByLabelText('Send to (parent/guardian)')
    await waitFor(() => expect(within(to).getAllByRole('option')).toHaveLength(3))
    expect(screen.queryByLabelText(/About which child/)).toBeNull() // nobody chosen yet
    fireEvent.change(to, { target: { value: '6' } })
    const child = screen.getByLabelText('About which child? (optional)')
    expect(within(child).getAllByRole('option').map((o) => o.textContent)).toEqual(['Not about one child', 'Brian Kamau', 'Cate Kamau'])
    // One child: chosen for you.
    fireEvent.change(to, { target: { value: '5' } })
    expect(screen.getByLabelText('About which child? (optional)')).toHaveValue('7')
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(studentsList).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Hello' } })
    fireEvent.click(screen.getByRole('button', { name: /^Send/ }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ participant_ids: [5], student: 7, body: 'Hello' }))
  })
})

describe('refreshing the page', () => {
  it('reopens the conversation that was open', async () => {
    const conversation = {
      id: 3, kind: 'direct', participants: [{ id: 5, name: 'Grace', kind: 'guardian' }, { id: 9, name: 'Mr Otieno', kind: 'staff' }],
      member_count: 2, can_reply: true, unread_count: 0, last_message: { body: 'Thanks' }, student_name: null,
    }
    mockApi.current = deepApiMock({
      'conversations.list': () => Promise.resolve([conversation]),
      'conversations.messages': () => Promise.resolve([{ id: 1, sender: 9, sender_name: 'Mr Otieno', body: 'See you Monday', created_at: '2026-09-28T08:00:00Z' }]),
    })
    const { unmount } = render(<Messages me={{ id: 5, name: 'Grace' }} identityKind="guardian" />)
    fireEvent.click(await screen.findByText('Thanks'))
    await screen.findByText('See you Monday')
    unmount()
    render(<Messages me={{ id: 5, name: 'Grace' }} identityKind="guardian" />)
    expect(await screen.findByText('See you Monday')).toBeInTheDocument()
    expect(screen.getByLabelText('Write a message')).toBeInTheDocument()
  })

  it('shows the list when the remembered conversation has gone', async () => {
    sessionStorage.setItem('hm.page.panel.messages.open', '99')
    mockApi.current = deepApiMock({ 'conversations.list': () => Promise.resolve([]) })
    render(<Messages me={{ id: 5, name: 'Grace' }} identityKind="guardian" />)
    await waitFor(() => expect(sessionStorage.getItem('hm.page.panel.messages.open')).toBeNull())
    expect(screen.queryByLabelText('Write a message')).toBeNull()
  })
})

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

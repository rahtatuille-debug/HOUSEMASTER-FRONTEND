import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearDrafts, loadDraft, saveDraft } from './drafts.js'
import { api } from './api.js'

beforeEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('unsaved work kept on the phone', () => {
  it('keeps a draft per signed-in person, so someone else on a shared phone never sees it', () => {
    saveDraft(1, 'attendance:5:2026-09-30', { 2: 'absent' })
    expect(loadDraft(1, 'attendance:5:2026-09-30')).toEqual({ 2: 'absent' })
    expect(loadDraft(7, 'attendance:5:2026-09-30')).toBeNull()
  })

  it('removes a draft when it is saved empty', () => {
    saveDraft(1, 'k', { a: 1 })
    saveDraft(1, 'k', null)
    expect(loadDraft(1, 'k')).toBeNull()
  })

  it('forgets drafts older than a week', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    saveDraft(1, 'k', { a: 1 })
    Date.now.mockReturnValue(now + 8 * 24 * 3600 * 1000)
    expect(loadDraft(1, 'k')).toBeNull()
  })

  it('deletes every draft on sign-out', () => {
    saveDraft(1, 'a', { x: 1 })
    saveDraft(2, 'b', { y: 1 })
    localStorage.setItem('unrelated', 'stays')
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    api.logout()
    expect(loadDraft(1, 'a')).toBeNull()
    expect(loadDraft(2, 'b')).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('stays')
  })

  it('carries on without drafts when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceeded') })
    expect(() => saveDraft(1, 'k', { a: 1 })).not.toThrow()
    clearDrafts()
  })
})

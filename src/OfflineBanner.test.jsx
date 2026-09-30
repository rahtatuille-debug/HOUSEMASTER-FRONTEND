import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OfflineBanner from './OfflineBanner.jsx'
import { connection } from './connection.js'

function setOnline(value) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
  window.dispatchEvent(new Event(value ? 'online' : 'offline'))
}

beforeEach(() => {
  vi.restoreAllMocks()
  vi.useFakeTimers()
  connection.reset()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('offline banner', () => {
  it('shows nothing while the connection is fine', () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('says the phone is offline and that changes can’t be saved yet', () => {
    render(<OfflineBanner />)
    act(() => setOnline(false))
    const banner = screen.getByRole('status')
    expect(banner).toHaveTextContent(/offline/i)
    expect(banner).toHaveTextContent(/can’t be saved|can't be saved/i)
  })

  it('says the server can’t be reached when the phone is online but requests fail', () => {
    render(<OfflineBanner />)
    act(() => connection.report(false))
    expect(screen.getByRole('status')).toHaveTextContent(/weak|can’t reach|can't reach/i)
  })

  it('checks the server again when the phone reconnects, and says it is back', async () => {
    const ping = vi.fn(() => Promise.resolve(true))
    render(<OfflineBanner ping={ping} />)
    act(() => connection.report(false))
    await act(async () => setOnline(true))
    expect(ping).toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(/back online/i)
  })

  it('keeps checking while the server can’t be reached, so the banner clears by itself', async () => {
    const ping = vi.fn(() => Promise.resolve(false))
    render(<OfflineBanner ping={ping} />)
    act(() => connection.report(false))
    await act(async () => vi.advanceTimersByTime(15000))
    expect(ping).toHaveBeenCalledTimes(1)
    ping.mockImplementation(() => Promise.resolve(true))
    await act(async () => vi.advanceTimersByTime(15000))
    expect(screen.getByRole('status')).toHaveTextContent(/back online/i)
  })

  it('says it is back online, then disappears', () => {
    render(<OfflineBanner />)
    act(() => setOnline(false))
    act(() => setOnline(true))
    expect(screen.getByRole('status')).toHaveTextContent(/back online/i)
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByRole('status')).toBeNull()
  })
})

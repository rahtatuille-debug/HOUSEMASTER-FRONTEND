import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { usePullToRefresh } from './pullToRefresh.js'

function Probe({ onRefresh, enabled = true }) {
  const { pull, ready } = usePullToRefresh(enabled, onRefresh)
  return <div data-testid="probe" data-pull={pull} data-ready={String(ready)} />
}

function touch(type, y, target = window) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  e.touches = type === 'touchend' ? [] : [{ clientX: 100, clientY: y }]
  act(() => { target.dispatchEvent(e) })
}

describe('pull to refresh', () => {
  it('refreshes after a long enough pull from the top of the page', () => {
    const onRefresh = vi.fn()
    const { getByTestId } = render(<Probe onRefresh={onRefresh} />)
    touch('touchstart', 100, getByTestId('probe'))
    touch('touchmove', 200, getByTestId('probe'))
    expect(Number(getByTestId('probe').dataset.pull)).toBe(50)
    touch('touchmove', 300, getByTestId('probe'))
    expect(getByTestId('probe').dataset.ready).toBe('true')
    touch('touchend', 0, getByTestId('probe'))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('does nothing for a short pull, a pull up, or when switched off', () => {
    const onRefresh = vi.fn()
    const { getByTestId, rerender } = render(<Probe onRefresh={onRefresh} />)
    touch('touchstart', 100, getByTestId('probe'))
    touch('touchmove', 150, getByTestId('probe'))
    touch('touchend', 0, getByTestId('probe'))
    expect(getByTestId('probe').dataset.pull).toBe('0')
    touch('touchstart', 300, getByTestId('probe'))
    touch('touchmove', 100, getByTestId('probe'))
    touch('touchend', 0, getByTestId('probe'))
    rerender(<Probe onRefresh={onRefresh} enabled={false} />)
    touch('touchstart', 100, getByTestId('probe'))
    touch('touchmove', 400, getByTestId('probe'))
    touch('touchend', 0, getByTestId('probe'))
    expect(onRefresh).not.toHaveBeenCalled()
  })

  it('leaves a pull inside a box that is scrolled down to that box', () => {
    const onRefresh = vi.fn()
    const { getByTestId } = render(<Probe onRefresh={onRefresh} />)
    const box = getByTestId('probe')
    Object.defineProperty(box, 'scrollTop', { value: 40 })
    touch('touchstart', 100, box)
    touch('touchmove', 400, box)
    touch('touchend', 0, box)
    expect(onRefresh).not.toHaveBeenCalled()
  })
})

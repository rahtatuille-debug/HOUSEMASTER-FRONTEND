import { useEffect, useState } from 'react'

const READY_AT = 70 // px pulled (after easing) that refreshes on release
const MAX = 110

// Phones: pulling down when the page is already at the top refreshes it, like Instagram. The page
// remembers where you were (remember.js), so the refresh comes back to the same place.
const reload = () => window.location.reload()

export function usePullToRefresh(enabled = true, onRefresh = reload) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    let startY = null
    let startX = 0
    let distance = 0

    function scrolledInside(el) {
      // A list or conversation scrolled down inside the page scrolls back up first.
      for (let node = el; node && node !== document.body; node = node.parentElement) {
        if (node.scrollTop > 0) return true
      }
      return false
    }

    function onStart(e) {
      if (e.touches.length !== 1 || window.scrollY > 0 || scrolledInside(e.target)
        || e.target.closest?.('input, textarea, select, [role="dialog"], .tour')) { startY = null; return }
      startY = e.touches[0].clientY
      startX = e.touches[0].clientX
      distance = 0
    }
    function onMove(e) {
      if (startY === null) return
      const dy = e.touches[0].clientY - startY
      const dx = Math.abs(e.touches[0].clientX - startX)
      if (dy <= 0 || dx > dy || window.scrollY > 0) { if (distance) { distance = 0; setPull(0) } return }
      distance = Math.min(MAX, dy * 0.5)
      setPull(distance)
      if (e.cancelable) e.preventDefault()
    }
    function onEnd() {
      if (startY === null) return
      startY = null
      if (distance >= READY_AT) {
        setRefreshing(true)
        setPull(READY_AT)
        onRefresh()
      } else setPull(0)
      distance = 0
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [enabled, onRefresh])

  return { pull, refreshing, ready: pull >= READY_AT }
}

import { useEffect, useLayoutEffect, useState } from 'react'

// A step-by-step tour of the menu: each step highlights one menu item and
// says what that part of HouseMaster is for. On a phone the menu drawer is
// opened so the items can be seen. `steps`: [{ key, title, text }], where a
// step without a menu item (the welcome and the end) shows in the middle.
export default function Tour({ steps, onClose, onShowMenu }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[index]
  const last = index === steps.length - 1

  // On a phone, the menu is a drawer: keep it open while the tour points at it.
  useEffect(() => { onShowMenu?.(Boolean(step.menu)) }, [step, onShowMenu])

  useLayoutEffect(() => {
    function place() {
      const el = step.menu && document.querySelector(`.sidebar-nav button[data-tab="${step.key}"]`)
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'nearest' })
      setRect(el.getBoundingClientRect())
    }
    place()
    // The drawer slides in, so measure again once it has settled.
    const timer = setTimeout(place, 260)
    window.addEventListener('resize', place)
    return () => { clearTimeout(timer); window.removeEventListener('resize', place) }
  }, [step])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose(false)
      if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1)
      if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, last, onClose])

  const narrow = window.innerWidth <= 768
  let cardStyle = {}
  if (rect) {
    cardStyle = narrow
      ? { left: 12, right: 12, bottom: 16 }
      : { left: rect.right + 16, top: Math.max(12, Math.min(rect.top - 20, window.innerHeight - 260)) }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour-spotlight" style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} />
      ) : (
        <div className="tour-backdrop" />
      )}
      <div className={`tour-card${rect ? '' : ' centered'}`} style={cardStyle}>
        <p className="eyebrow">{index + 1} of {steps.length}</p>
        <h3 id="tour-title">{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-actions">
          {!last && <button type="button" className="link-button" onClick={() => onClose(false)}>Skip tour</button>}
          <span style={{ flex: 1 }} />
          {index > 0 && <button type="button" className="secondary" onClick={() => setIndex(index - 1)}>Back</button>}
          {last
            ? <button type="button" onClick={() => onClose(true)}>Finish</button>
            : <button type="button" onClick={() => setIndex(index + 1)} autoFocus>Next</button>}
        </div>
      </div>
    </div>
  )
}

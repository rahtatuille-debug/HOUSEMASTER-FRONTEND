import { useEffect, useLayoutEffect, useState } from 'react'

// A step-by-step tour of the menu: each step highlights one menu button and
// says what that part of HouseMaster is for. `steps`: [{ key, title, text,
// targets }], where `targets` are selectors tried in order (the laptop rail,
// then the phone's bottom bar); a step without one (the welcome and the end)
// shows in the middle.
export default function Tour({ steps, onClose }) {
  const [index, setIndex] = useState(0)
  const [rect, setRect] = useState(null)
  const step = steps[index]
  const last = index === steps.length - 1

  useLayoutEffect(() => {
    function place() {
      // The first target that is actually on screen (the rail is hidden on a phone, the bottom bar on a laptop).
      const el = (step.targets || []).map((sel) => document.querySelector(sel))
        .find((e) => e && e.getBoundingClientRect().width > 0)
      if (!el) { setRect(null); return }
      el.scrollIntoView({ block: 'nearest' })
      setRect(el.getBoundingClientRect())
    }
    place()
    // Measure again once the layout has settled.
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

  // Beside the button when there's room, otherwise below it (top bar) or above it (phone's bottom bar).
  let cardStyle = {}
  if (rect) {
    const w = window.innerWidth
    const h = window.innerHeight
    if (rect.top > h * 0.6) cardStyle = { left: 12, right: 12, bottom: h - rect.top + 12 }
    else if (rect.right + 360 <= w) cardStyle = { left: rect.right + 16, top: Math.max(12, Math.min(rect.top - 20, h - 260)) }
    else cardStyle = { right: 12, top: rect.bottom + 12, maxWidth: Math.min(340, w - 24) }
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

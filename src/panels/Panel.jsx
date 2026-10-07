import { useEffect, useRef, useState } from 'react'

// One dashboard panel: a title bar (with an optional "…" menu), the content,
// and a row of actions along the bottom. Every panel looks the same, so the
// dashboard reads as one tidy page.
export default function Panel({ title, menu = [], actions, children, className = '', wide = false }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', esc) }
  }, [open])

  return (
    <section className={`dash-panel${wide ? ' wide' : ''} ${className}`} aria-label={title}>
      <header className="dash-panel-head">
        <h3>{title}</h3>
        {menu.length > 0 && (
          <div className="dash-panel-menu" ref={menuRef}>
            <button type="button" className="dash-dots" aria-label={`More for ${title}`} aria-expanded={open}
              onClick={() => setOpen((v) => !v)}>⋯</button>
            {open && (
              <div className="dash-menu-pop" role="menu">
                {menu.map((m) => (
                  <button key={m.label} type="button" role="menuitem" onClick={() => { setOpen(false); m.onClick() }}>{m.label}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </header>
      <div className="dash-panel-body">{children}</div>
      {actions && <footer className="dash-panel-foot">{actions}</footer>}
    </section>
  )
}

// Tabs inside a panel (e.g. Bulletin | Absent today | Boarding).
export function PanelTabs({ tabs, value, onChange, label }) {
  return (
    <div className="dash-tabs" role="tablist" aria-label={label}>
      {tabs.map(([key, name]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} className={value === key ? 'active' : ''}
          onClick={() => onChange(key)}>{name}</button>
      ))}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'

// "Approve all": every report waiting in a year group or one class, for a
// term, in one go. Reports still missing a comment or summary stay waiting.
export default function ApproveAll({ onDone }) {
  const words = useVocab()
  const [groups, setGroups] = useState(null)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.reports.waiting().then((g) => setGroups(Array.isArray(g) ? g : [])).catch(() => setGroups([]))
  useEffect(() => { load() }, [])

  async function approve(group, target, name, count) {
    if (!window.confirm(`Approve all ${count} waiting report${count === 1 ? '' : 's'} in ${name} (${group.term_name}) and release them to parents?`)) return
    const key = JSON.stringify(target)
    setBusy(key)
    setError('')
    setNotice('')
    try {
      const r = await api.reports.approveAll({ term: group.term, ...target })
      setNotice(`Approved ${r.count} report${r.count === 1 ? '' : 's'} in ${name}. Parents can now see them.${r.blank
        ? ` ${r.blank} not finished (blank comment or summary) ${r.blank === 1 ? 'stays' : 'stay'} waiting.` : ''}`)
      await load()
      onDone?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  if (!groups || groups.length === 0) return null
  return (
    <div className="card approve-all">
      <h3 style={{ marginBottom: 4, fontSize: 15 }}>Approve all</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Approve every report waiting in a {words.year_group.toLowerCase()} or a {words.class.toLowerCase()} at once.
        Reports with a blank comment or summary stay waiting.
      </p>
      {error && <div className="error-banner" role="alert">{error}</div>}
      {notice && <div className="success-banner" role="status">{notice}</div>}
      <ul className="approve-all-list">
        {groups.map((g) => {
          const id = `${g.term}-${g.year_group}`
          const ready = g.count - g.blank
          return (
            <li key={id}>
              <div className="approve-all-row">
                <button type="button" className="link-button" aria-expanded={open === id} aria-label={`Show classes in ${g.year_group_name}`} onClick={() => setOpen(open === id ? null : id)}>
                  {open === id ? '▾' : '▸'} {g.year_group_name}
                </button>
                <span className="text-muted">{g.term_name} · {g.count} waiting{g.blank ? `, ${g.blank} not finished` : ''}</span>
                <button type="button" style={{ width: 'auto' }} disabled={!ready || busy !== ''}
                  aria-label={`Approve all in ${g.year_group_name}, ${g.term_name}`}
                  onClick={() => approve(g, { year_group: g.year_group }, g.year_group_name, ready)}>
                  {busy === JSON.stringify({ year_group: g.year_group }) ? 'Approving…' : `Approve all (${ready})`}
                </button>
              </div>
              {open === id && (
                <ul className="approve-all-classes">
                  {g.classes.map((c) => (
                    <li key={c.id} className="approve-all-row">
                      <span>{c.name}</span>
                      <span className="text-muted">{c.count} waiting{c.blank ? `, ${c.blank} not finished` : ''}</span>
                      <button type="button" className="secondary" style={{ width: 'auto' }} disabled={c.count === c.blank || busy !== ''}
                        aria-label={`Approve all in ${c.name}, ${g.term_name}`}
                        onClick={() => approve(g, { school_class: c.id }, c.name, c.count - c.blank)}>
                        Approve {words.class.toLowerCase()} ({c.count - c.blank})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

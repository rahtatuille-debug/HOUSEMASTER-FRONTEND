import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'
import Panel from './Panel.jsx'

export const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}
const pct = (v) => (v == null ? '—' : `${v}%`)
const place = (rank, of) => (rank == null ? '—' : `${ordinal(rank)} of ${of}`)
const tone = (rank, of) => (rank == null || of < 2 ? '' : rank === 1 ? 'rank-top' : rank === of ? 'rank-bottom' : '')

// How the teacher's classes are doing: each class's average and its position
// among the classes in its year group, overall and in each subject.
export default function ClassPerformance({ onNavigate }) {
  const words = useVocab()
  const [term, setTerm] = useState('')
  const [data, setData] = useState(null)
  const [open, setOpen] = useState({})
  useEffect(() => {
    // An older server has no such endpoint: show nothing rather than break the dashboard.
    api.teacherHome.performance(term || undefined)
      .then((d) => setData({ ...d, classes: Array.isArray(d?.classes) ? d.classes : [], terms: Array.isArray(d?.terms) ? d.terms : [] }))
      .catch(() => setData({ classes: [], terms: [], unavailable: true }))
  }, [term])
  if (data?.unavailable) return null
  if (!data) return <Panel title={`My ${words.classes.toLowerCase()}' performance`} wide><p className="text-muted dash-empty">Loading…</p></Panel>
  return (
    <Panel title={`My ${words.classes.toLowerCase()}' performance`} wide
      menu={[{ label: 'Open Performance', onClick: () => onNavigate('performance') }]}>
      {data.terms?.length > 1 && (
        <label className="perf-term">{words.term}
          <select value={term || data.term || ''} onChange={(e) => setTerm(e.target.value)}>
            {data.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      {data.classes.length === 0 ? (
        <p className="text-muted dash-empty">No marks yet for your {words.classes.toLowerCase()}{data.term_name ? ` in ${data.term_name}` : ''}.</p>
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            Position among the {words.classes.toLowerCase()} in the same {words.year_group.toLowerCase()}, {data.term_name}. Your {words.subjects.toLowerCase()} are in bold.
          </p>
          <ul className="perf-list">
            {data.classes.map((c) => (
              <li key={c.id} className="perf-class">
                <button type="button" className="perf-head" aria-expanded={!!open[c.id]} onClick={() => setOpen({ ...open, [c.id]: !open[c.id] })}>
                  <span className="perf-name"><strong>{c.name}</strong><span className="text-muted"> · {c.year_group}</span></span>
                  <span className="perf-avg">{pct(c.average)}</span>
                  <span className={`perf-rank ${tone(c.rank, c.of)}`}>{place(c.rank, c.of)}</span>
                  <span className="text-muted perf-year">{words.year_group} {pct(c.year_average)}</span>
                </button>
                {open[c.id] && (
                  <table className="dash-table perf-table">
                    <thead><tr><th>{words.subject}</th><th>{words.class}</th><th>{words.year_group}</th><th>Position</th></tr></thead>
                    <tbody>
                      {c.subjects.map((s) => (
                        <tr key={s.subject} className={s.teaches ? 'mine' : ''}>
                          <td>{s.teaches ? <strong>{s.subject}</strong> : s.subject}</td>
                          <td>{pct(s.average)}</td>
                          <td>{pct(s.year_average)}</td>
                          <td><span className={`perf-rank ${tone(s.rank, s.of)}`}>{place(s.rank, s.of)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

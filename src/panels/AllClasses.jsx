import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { useVocab } from '../levels.js'
import { ordinal } from './ClassPerformance.jsx'
import Panel, { PanelTabs } from './Panel.jsx'

const pct = (v) => (v == null ? '—' : `${v}%`)
const tone = (rank, of) => (rank == null || of < 2 ? '' : rank === 1 ? 'rank-top' : rank === of ? 'rank-bottom' : '')

// Every class in the school, one year group at a time: its average, its
// position in the year group and each subject's average. Class figures only,
// never a student's marks.
export default function AllClasses() {
  const words = useVocab()
  const [term, setTerm] = useState('')
  const [data, setData] = useState(null)
  const [year, setYear] = useState(null)
  useEffect(() => {
    // An older server has no such endpoint: show nothing rather than break the dashboard.
    api.teacherHome.allClasses(term || undefined)
      .then((d) => setData({ ...d, year_groups: Array.isArray(d?.year_groups) ? d.year_groups : [], terms: Array.isArray(d?.terms) ? d.terms : [] }))
      .catch(() => setData({ year_groups: [], terms: [], unavailable: true }))
  }, [term])
  const title = `All ${words.classes.toLowerCase()}`
  if (data?.unavailable) return null
  if (!data) return <Panel title={title} wide><p className="text-muted dash-empty">Loading…</p></Panel>
  const years = data.year_groups
  // Start on the first year group with one of my classes in it.
  const shown = years.find((y) => y.id === year) || years.find((y) => y.classes?.some((c) => c.mine)) || years[0]
  const subjects = shown?.subjects || []
  return (
    <Panel title={title} wide className="all-classes">
      {data.terms.length > 1 && (
        <label className="perf-term">{words.term}
          <select value={term || data.term || ''} onChange={(e) => setTerm(e.target.value)}>
            {data.terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
      )}
      {!shown ? (
        <p className="text-muted dash-empty">No marks yet{data.term_name ? ` in ${data.term_name}` : ''}.</p>
      ) : (
        <>
          {years.length > 1 && (
            <PanelTabs label={words.year_group} value={shown.id} onChange={setYear}
              tabs={years.map((y) => [y.id, y.name])} />
          )}
          <p className="hint" style={{ marginTop: 0 }}>
            {words.class} averages for {data.term_name}, and each {words.class.toLowerCase()}&apos;s position in {shown.name}
            {shown.average != null ? ` (${words.year_group.toLowerCase()} average ${pct(shown.average)})` : ''}. Your {words.classes.toLowerCase()} are highlighted.
          </p>
          <div className="table-scroll">
            <table className="dash-table all-classes-table" aria-label={`${shown.name} ${words.classes.toLowerCase()}`}>
              <thead>
                <tr>
                  <th scope="col">{words.class}</th>
                  <th scope="col">Students</th>
                  <th scope="col">Average</th>
                  <th scope="col">Position</th>
                  {subjects.map((s) => <th key={s} scope="col">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {(shown.classes || []).map((c) => (
                  <tr key={c.id} className={c.mine ? 'mine' : ''}>
                    <td className="ac-name">{c.mine ? <strong>{c.name}</strong> : c.name}{c.mine && <span className="text-muted"> · yours</span>}</td>
                    <td>{c.students}</td>
                    <td><strong>{pct(c.average)}</strong></td>
                    <td>{c.rank == null ? '—' : <span className={`perf-rank ${tone(c.rank, c.of)}`}>{ordinal(c.rank)} of {c.of}</span>}</td>
                    {subjects.map((s) => <td key={s}>{pct(c.subjects?.[s])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint" style={{ marginBottom: 0 }}>
            — means fewer than {data.min_group || 3} students have marks, so no figure is shown.
          </p>
        </>
      )}
    </Panel>
  )
}

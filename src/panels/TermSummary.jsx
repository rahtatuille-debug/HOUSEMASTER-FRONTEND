import { useVocab } from '../levels.js'

const pct = (v) => (v == null ? '—' : `${Math.round(v)}%`)

// The headline figures for a term, the way the school's system reports them.
function Headline({ summary, words }) {
  const tiles = []
  if (summary.system === '844' && summary.mean_grade) {
    tiles.push(['Mean grade', summary.mean_grade, `${summary.mean_points} points · ${summary.total_points} in total`])
    if (summary.positions) {
      tiles.push([`Position in ${words.class.toLowerCase()}`, `${summary.positions.stream.position} of ${summary.positions.stream.of}`])
      tiles.push([`Position in ${words.year_group.toLowerCase()}`, `${summary.positions.form.position} of ${summary.positions.form.of}`])
    }
  } else if (summary.system === 'american' && summary.gpa != null) {
    tiles.push(['GPA', summary.gpa.toFixed(2), `4.0 scale · ${summary.credits} credits`])
    if (summary.honor_roll) tiles.push(['Honors', summary.honor_roll])
  } else if (summary.system === 'ib' && summary.ib_total != null) {
    tiles.push(['Total of grades', summary.ib_total, `${summary.subjects.filter((r) => r.ib_grade != null).length} subjects`])
  }
  if (summary.average != null) {
    tiles.push(['Average', pct(summary.average), summary.average_level ? `Level ${summary.average_level}` : undefined])
  }
  if (!tiles.length) return null
  return (
    <div className="stat-row">
      {tiles.map(([label, value, sub]) => (
        <div className="stat-tile" key={label}>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
          {sub && <div className="text-muted" style={{ fontSize: 12 }}>{sub}</div>}
        </div>
      ))}
    </div>
  )
}

// A term's results for one student: headline figures and a row per subject,
// with the columns the school's system uses.
export default function TermSummary({ summary }) {
  const words = useVocab()
  if (!summary) return null
  if (!summary.subjects.length) return <p className="text-muted" style={{ margin: 0 }}>No results recorded for this {words.term.toLowerCase()} yet.</p>
  const system = summary.system
  const columns = {
    844: [['Marks', (r) => pct(r.percent)], ['Grade', (r) => r.kcse_grade || '—'], ['Points', (r) => r.points ?? '—']],
    american: [['Percent', (r) => pct(r.percent)], ['Grade', (r) => r.letter || '—'], ['Credits', (r) => r.credits]],
    ib: [['A', (r) => r.criteria?.A ?? '—'], ['B', (r) => r.criteria?.B ?? '—'], ['C', (r) => r.criteria?.C ?? '—'],
      ['D', (r) => r.criteria?.D ?? '—'], ['Grade', (r) => r.ib_grade ?? '—']],
    british: [['Percent', (r) => pct(r.percent)], ['Grade', (r) => r.level || '—'], ['Effort', (r) => r.effort || '—'],
      ['Target', (r) => r.target || '—']],
  }[system] || [['Percent', (r) => pct(r.percent)], ...(summary.subjects.some((r) => r.level) ? [['Level', (r) => r.level || '—']] : [])]

  return (
    <>
      <Headline summary={summary} words={words} />
      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>{words.subject}</th>{columns.map(([label]) => <th key={label}>{label}</th>)}<th>Comment</th></tr>
          </thead>
          <tbody>
            {summary.subjects.map((r) => (
              <tr key={r.subject}>
                <td>{r.subject}</td>
                {columns.map(([label, value]) => <td key={label}>{value(r)}</td>)}
                <td className="text-muted">{r.comment || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

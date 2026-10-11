import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { ScaleContext, useVocab, useWithLevel } from '../levels.js'
import { formatDate } from '../format.js'
import ChartCard from './ChartCard.jsx'
import { BENCHMARK, BarChart, CATEGORICAL, COMPARE, LineChart, MARKERS, RadarChart } from './charts.jsx'

// Five more graphs about one student (P-1 … P-5), and subject trends for a group (P-1). The numbers come from
// /api/analytics/charts/ (staff) or the child's /charts/ (parents), which work them out exactly as the rest of the
// Performance page does. A missing value is always a gap or "no marks", never a zero. See docs/CHARTS.md.

const DEFAULT_SUBJECTS = 6
const SUBJECTS_KEY = 'hm.charts.subjects'
const MIN_TERMS = 2

// Load one chart; anything that fails (e.g. an older server without these charts) is a quiet "not available".
function useChart(load, deps) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let live = true
    setState({ loading: true })
    load().then((data) => live && setState({ data })).catch(() => live && setState({ unavailable: true }))
    return () => { live = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}

function Quiet({ state, children }) {
  if (state.loading) return <p className="text-muted" style={{ margin: 0 }}>Loading…</p>
  if (state.unavailable || !state.data) return <p className="text-muted" style={{ margin: 0 }}>Not available yet.</p>
  return children
}

// Each subject keeps one colour and marker on the whole page: by its place in the full, sorted subject list.
function subjectStyle(subject, all) {
  const i = Math.max(0, all.indexOf(subject))
  return { color: CATEGORICAL[i % CATEGORICAL.length], marker: MARKERS[i % MARKERS.length] }
}

const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`
}

function readChosen() {
  try { return JSON.parse(localStorage.getItem(SUBJECTS_KEY) || 'null') } catch { return null }
}

// ---- P-1 ------------------------------------------------------------------------------------------------------

export function SubjectTrends({ data, valueKey = 'student', allowCompare = true }) {
  const fmt = useWithLevel()
  const words = useVocab()
  const all = data.subjects.map((s) => s.subject)
  // The six subjects with the most terms of marks (or the ones this person chose last time).
  const byData = [...data.subjects].sort((a, b) => b.points.filter((p) => p[valueKey] != null).length - a.points.filter((p) => p[valueKey] != null).length
    || a.subject.localeCompare(b.subject)).map((s) => s.subject)
  const [chosen, setChosen] = useState(() => {
    const saved = readChosen()?.filter((s) => all.includes(s))
    return saved?.length ? saved : byData.slice(0, DEFAULT_SUBJECTS)
  })
  const [compare, setCompare] = useState(false)
  const canCompare = allowCompare && data.subjects.some((s) => s.points.some((p) => p.class != null))

  function toggle(subject) {
    const next = chosen.includes(subject) ? chosen.filter((s) => s !== subject) : [...chosen, subject]
    setChosen(next)
    try { localStorage.setItem(SUBJECTS_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }

  const rows = data.terms.map((t, i) => {
    const row = { term: t.name }
    for (const s of data.subjects) {
      row[s.subject] = s.points[i]?.[valueKey] ?? null
      row[`${s.subject}__class`] = s.points[i]?.class ?? null
    }
    return row
  })
  const series = chosen.filter((s) => all.includes(s)).flatMap((subject) => {
    const style = subjectStyle(subject, all)
    return [{ key: subject, label: subject, short: subject.length > 12 ? `${subject.slice(0, 11)}…` : subject, ...style },
      ...(compare && canCompare ? [{ key: `${subject}__class`, label: `${subject} (class)`, short: '', ...style, dashed: true }] : [])]
  })
  const termsWithMarks = rows.filter((r) => chosen.some((s) => r[s] != null)).length
  const table = (
    <table>
      <thead><tr><th>{words.subject}</th>{data.terms.map((t) => <th key={t.id}>{t.name}</th>)}</tr></thead>
      <tbody>{data.subjects.map((s) => (
        <tr key={s.subject}><td>{s.subject}</td>{s.points.map((p) => (
          <td key={p.term_id}>{p[valueKey] == null ? <span className="text-muted">no marks</span> : fmt(p[valueKey], 1)}
            {p.class != null && allowCompare && <span className="text-muted"> (class {fmt(p.class, 1)})</span>}</td>
        ))}</tr>
      ))}</tbody>
    </table>
  )
  return (
    <ChartCard title={`${words.subjects} over ${words.terms.toLowerCase()}`}
      hint={`One line per ${words.subject.toLowerCase()}. A gap means no marks that ${words.term.toLowerCase()}.`}
      table={table}
      actions={(
        <div className="chart-controls">
          <fieldset className="chart-pick">
            <legend className="sr-only">{words.subjects} to show</legend>
            {all.map((subject) => {
              const style = subjectStyle(subject, all)
              return (
                <label key={subject} className="checkbox-label">
                  <input type="checkbox" checked={chosen.includes(subject)} onChange={() => toggle(subject)} />
                  <span className="chart-swatch" style={{ background: style.color }} aria-hidden="true" />{subject}
                </label>
              )
            })}
          </fieldset>
          {canCompare && (
            <label className="checkbox-label"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Compare with class average</label>
          )}
        </div>
      )}>
      {!all.length ? <p className="text-muted" style={{ margin: 0 }}>No marks yet.</p>
        : termsWithMarks < MIN_TERMS ? <p className="text-muted" style={{ margin: 0 }}>Not enough {words.terms.toLowerCase()} yet. Show as table to see what there is.</p>
          : !series.length ? <p className="text-muted" style={{ margin: 0 }}>Choose a {words.subject.toLowerCase()} above.</p>
            : <LineChart data={rows} series={series} gaps label={`${data.name}: ${chosen.join(', ')} by ${words.term.toLowerCase()}`}
              pointLabel={(row, s) => `${s.label}, ${row.term}: ${fmt(row[s.key], 1)}`} />}
    </ChartCard>
  )
}

export function GroupSubjectTrends({ scope, id, name }) {
  const state = useChart(() => api.charts({ chart: 'subject_trends', scope, ...(id ? { id } : {}) }), [scope, id])
  return (
    <Quiet state={state}>
      {state.data && (
        <ScaleContext.Provider value={state.data.grading?.scale || null}>
          <SubjectTrends data={{ ...state.data, name }} valueKey="average" allowCompare={false} />
        </ScaleContext.Provider>
      )}
    </Quiet>
  )
}

// ---- P-5 ------------------------------------------------------------------------------------------------------

export function StrengthsRadar({ data, termId, allowCompare = true }) {
  const fmt = useWithLevel()
  const words = useVocab()
  const index = data.terms.findIndex((t) => String(t.id) === String(termId))
  const i = index >= 0 ? index : data.terms.length - 1
  const term = data.terms[i]
  const axes = data.subjects.map((s) => ({ label: s.subject, value: s.points[i]?.student ?? null, compare: allowCompare ? s.points[i]?.class ?? null : null }))
    .filter((a) => a.value != null)
  if (!term) return null
  const sorted = [...axes].sort((a, b) => b.value - a.value)
  const summary = !sorted.length ? '' : sorted[0].value === sorted[sorted.length - 1].value
    ? `Every ${words.subject.toLowerCase()} is at ${fmt(sorted[0].value, 1)}.`
    : `Strongest in ${sorted[0].label} (${fmt(sorted[0].value, 1)}); weakest in ${sorted[sorted.length - 1].label} (${fmt(sorted[sorted.length - 1].value, 1)}).`
  const withCompare = allowCompare && axes.length > 0 && axes.every((a) => a.compare != null)
  const table = (
    <table>
      <thead><tr><th>{words.subject}</th><th>{data.name}</th>{allowCompare && <th>Class average</th>}</tr></thead>
      <tbody>{data.subjects.map((s) => (
        <tr key={s.subject}><td>{s.subject}</td><td>{s.points[i]?.student == null ? <span className="text-muted">no marks</span> : fmt(s.points[i].student, 1)}</td>
          {allowCompare && <td>{s.points[i]?.class == null ? <span className="text-muted">not shown</span> : fmt(s.points[i].class, 1)}</td>}</tr>
      ))}</tbody>
    </table>
  )
  const fits = axes.length >= 3 && axes.length <= 10
  return (
    <ChartCard title={`Strengths, ${term.name}`} hint={fits ? `Each ${words.subject.toLowerCase()} on one shape, 0 to 100%.${withCompare ? ' The dashed outline is the class average.' : ''}` : null} table={table}>
      {!axes.length ? <p className="text-muted" style={{ margin: 0 }}>No marks this {words.term.toLowerCase()}.</p> : fits ? (
        <RadarChart axes={axes} valueLabel={data.name} compareLabel={withCompare ? 'Class average' : null}
          label={`${data.name}, ${term.name}: ${axes.map((a) => `${a.label} ${fmt(a.value, 1)}`).join('; ')}`} />
      ) : (
        <>
          <p className="hint" style={{ marginTop: 0 }}>
            A radar needs 3 to 10 {words.subjects.toLowerCase()}; this {words.term.toLowerCase()} has {axes.length}, so here is a bar chart instead.
          </p>
          <BarChart rows={axes.map((a) => ({ label: a.label, value: a.value, compare: withCompare ? a.compare : null }))}
            bars={[{ key: 'value', label: data.name, color: COMPARE[0] }, { key: 'compare', label: 'Class average', color: COMPARE[1] }]}
            label={`${data.name} by ${words.subject.toLowerCase()}, ${term.name}`} />
        </>
      )}
      {summary && <p className="chart-summary">{summary}</p>}
    </ChartCard>
  )
}

// ---- P-2 ------------------------------------------------------------------------------------------------------

export function AssessmentTypes({ studentId, termId }) {
  const fmt = useWithLevel()
  const words = useVocab()
  const [subject, setSubject] = useState('')
  const state = useChart(() => api.charts({ chart: 'assessment_types', scope: 'student', id: studentId, ...(termId ? { term: termId } : {}), ...(subject ? { subject } : {}) }),
    [studentId, termId, subject])
  const data = state.data
  const shown = (data?.types || []).filter((t) => t.student != null)
  const rows = shown.map((t) => ({ label: t.name, student: t.student, class: t.class }))
  let note = ''
  if (shown.length >= 2) {
    const hi = shown.reduce((a, b) => (b.student > a.student ? b : a))
    const lo = shown.reduce((a, b) => (b.student < a.student ? b : a))
    const gap = Math.round(hi.student - lo.student)
    if (gap >= 10) note = `Averages ${gap} points lower in ${lo.name} than in ${hi.name}.`
  }
  const table = data && (
    <table>
      <thead><tr><th>Assessment type</th><th>Weight</th><th>Marks</th><th>{data.name}</th><th>Class average</th></tr></thead>
      <tbody>{data.types.map((t) => (
        <tr key={t.id ?? 'none'}><td>{t.name}</td><td>{t.weight == null ? '—' : `${t.weight}%`}</td><td>{t.marks}</td>
          <td>{t.student != null ? fmt(t.student, 1) : <span className="text-muted">{t.reason || 'no marks'}</span>}</td>
          <td>{t.class == null ? <span className="text-muted">not shown</span> : fmt(t.class, 1)}</td></tr>
      ))}</tbody>
    </table>
  )
  return (
    <ChartCard title={`Assessment types${data?.term ? `, ${data.term.name}` : ''}`} table={table}
      hint={data?.weighted ? `The school weights these types (see the table) when it works out a ${words.subject.toLowerCase()} result; here each is shown on its own.` : null}
      actions={data && (
        <div className="field chart-controls" style={{ maxWidth: 260 }}>
          <label htmlFor={`p2-subject-${studentId}`}>{words.subject}</label>
          <select id={`p2-subject-${studentId}`} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All {words.subjects.toLowerCase()}</option>
            {data.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}>
      <Quiet state={state}>
        {data && (!rows.length ? <p className="text-muted" style={{ margin: 0 }}>Not enough marks of any one type{subject ? ` in ${subject}` : ''} yet.</p> : (
          <>
            <BarChart rows={rows} bars={[{ key: 'student', label: data.name, color: COMPARE[0] }, { key: 'class', label: 'Class average', color: COMPARE[1] }]}
              label={`${data.name} by assessment type: ${rows.map((r) => `${r.label} ${fmt(r.student, 1)}`).join('; ')}`} />
            {note && <p className="chart-summary">{note}</p>}
            {data.types.some((t) => t.reason) && (
              <p className="hint" style={{ marginBottom: 0 }}>Not shown: {data.types.filter((t) => t.reason).map((t) => `${t.name} (${t.reason.toLowerCase()})`).join(', ')}.</p>
            )}
          </>
        ))}
      </Quiet>
    </ChartCard>
  )
}

// ---- P-3 ------------------------------------------------------------------------------------------------------

export function MarksInTerm({ load, deps, idKey, showTypes = true }) {
  const fmt = useWithLevel()
  const words = useVocab()
  const [subject, setSubject] = useState('')
  const state = useChart(load, deps)
  const data = state.data
  const dayText = (iso) => formatDate(iso, { day: 'numeric', month: 'short' })
  const rows = useMemo(() => {
    if (!data) return []
    if (subject) {
      return data.points.filter((p) => p.subject === subject).map((p) => ({ ...p, label: dayText(p.date), value: p.percent }))
    }
    // All subjects: the average of the marks recorded each day.
    const days = {}
    for (const p of data.points) (days[p.date] ||= []).push(p.percent)
    return Object.entries(days).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, values]) => ({ date, label: dayText(date), value: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10, count: values.length }))
  }, [data, subject]) // eslint-disable-line react-hooks/exhaustive-deps
  const series = [{ key: 'value', label: subject || `Average of the day's marks`, color: COMPARE[0] }]
  const table = data && (
    <table>
      <thead><tr><th>Recorded</th><th>{words.subject}</th>{showTypes && <th>Type</th>}<th>Mark</th></tr></thead>
      <tbody>{data.points.filter((p) => !subject || p.subject === subject).map((p, k) => (
        <tr key={k}><td>{dayText(p.date)}</td><td>{p.subject}</td>{showTypes && <td>{p.assessment_type}</td>}<td>{fmt(p.percent, 1)}</td></tr>
      ))}</tbody>
    </table>
  )
  return (
    <ChartCard title={`Marks through the ${words.term.toLowerCase()}${data?.term ? `, ${data.term.name}` : ''}`} table={table}
      hint={data ? `Each mark by the day it was recorded (school time${data.time_zone ? `, ${data.time_zone}` : ''}), which may be after the assessment itself.` : null}
      actions={data?.subjects?.length > 0 && (
        <div className="field chart-controls" style={{ maxWidth: 260 }}>
          <label htmlFor={`p3-subject-${idKey}`}>{words.subject}</label>
          <select id={`p3-subject-${idKey}`} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All {words.subjects.toLowerCase()} (average each day)</option>
            {data.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}>
      <Quiet state={state}>
        {data && (!rows.length ? <p className="text-muted" style={{ margin: 0 }}>No marks recorded in this {words.term.toLowerCase()} yet.</p> : (
          <LineChart data={rows} series={series} dates={data.term?.start && data.term?.end ? { start: data.term.start, end: data.term.end } : { start: rows[0].date, end: rows[rows.length - 1].date }}
            label={`${data.name}: marks recorded through ${data.term?.name || 'the term'}`}
            pointLabel={(row) => subject ? `${row.subject}${showTypes ? `, ${row.assessment_type}` : ''}, recorded ${row.label}: ${fmt(row.value, 1)}`
              : `${row.label}: average ${fmt(row.value, 1)} of ${row.count} mark${row.count === 1 ? '' : 's'}`} />
        ))}
        {data?.outside_term > 0 && (
          <p className="hint" style={{ marginBottom: 0 }}>
            {data.outside_term} mark{data.outside_term === 1 ? ' was' : 's were'} recorded outside this {words.term.toLowerCase()}&apos;s dates (for example, entered later) and {data.outside_term === 1 ? "isn't" : "aren't"} shown.
          </p>
        )}
      </Quiet>
    </ChartCard>
  )
}

// ---- P-4 ------------------------------------------------------------------------------------------------------

const RANK_SERIES = [
  { key: 'class', label: 'In class', color: COMPARE[0], marker: 'circle' },
  { key: 'year_group', label: 'In year group', color: COMPARE[1], marker: 'square' },
  { key: 'school', label: 'In school', color: BENCHMARK, marker: 'triangle' },
]

export function RankOverTime({ load, deps, quietWhenUnranked = false }) {
  const words = useVocab()
  const state = useChart(load, deps)
  const data = state.data
  if (quietWhenUnranked && (state.unavailable || (data && !data.ranked))) return null
  const keys = data ? RANK_SERIES.filter((s) => data.points.some((p) => p[s.key] !== undefined)) : []
  const series = keys.map((s) => ({ ...s, label: s.key === 'year_group' ? `In ${words.year_group.toLowerCase()}` : s.key === 'class' ? `In ${words.class.toLowerCase()}` : s.label }))
  const rows = (data?.points || []).map((p) => {
    const row = { term: p.term }
    for (const s of keys) {
      row[s.key] = p[s.key]?.position ?? null
      row[`${s.key}_of`] = p[s.key]?.of ?? null
      row[`${s.key}_why`] = p[s.key]?.reason || ''
    }
    return row
  })
  const most = Math.max(2, ...rows.flatMap((r) => keys.map((s) => r[`${s.key}_of`] || 0)))
  const ticks = [...new Set([1, Math.ceil(most / 4), Math.ceil(most / 2), Math.ceil((most * 3) / 4), most])].filter((v) => v >= 1).sort((a, b) => a - b)
  const place = (row, s) => (row[s.key] == null ? (row[`${s.key}_why`] || 'not ranked') : `${ordinal(row[s.key])} of ${row[`${s.key}_of`]}`)
  const ranked = rows.filter((r) => keys.some((s) => r[s.key] != null)).length
  const table = data?.ranked && (
    <table>
      <thead><tr><th>{words.term}</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.term}><td>{r.term}</td>{series.map((s) => <td key={s.key}>{r[s.key] == null ? <span className="text-muted">{place(r, s)}</span> : place(r, s)}</td>)}</tr>)}</tbody>
    </table>
  )
  return (
    <ChartCard title={`Position over ${words.terms.toLowerCase()}`} table={table} hint={data?.ranked ? `1st is at the top. ${data.basis_note || ''}` : null}>
      <Quiet state={state}>
        {data && (!data.ranked ? <p className="text-muted" style={{ margin: 0 }}>{data.reason}</p>
          : ranked < MIN_TERMS ? <p className="text-muted" style={{ margin: 0 }}>Not enough {words.terms.toLowerCase()} yet. Show as table to see what there is.</p>
            : <LineChart data={rows} series={series} gaps yAxis={{ min: 1, max: most, reverse: true, ticks, format: (v) => ordinal(v) }}
              valueText={(row, s) => place(row, s)} pointLabel={(row, s) => `${s.label}, ${row.term}: ${place(row, s)}`}
              label={`${data.name}: position each ${words.term.toLowerCase()}`} />)}
      </Quiet>
    </ChartCard>
  )
}

// ---- Putting them together ---------------------------------------------------------------------------------------

// Staff: everything about one student. `only="trends"` for the student profile (P-1 alone).
export default function StudentCharts({ studentId, termId, only }) {
  const trends = useChart(() => api.charts({ chart: 'subject_trends', scope: 'student', id: studentId }), [studentId])
  const scale = trends.data?.grading?.scale || null
  return (
    <ScaleContext.Provider value={scale}>
      <Quiet state={trends}>
        {trends.data && <SubjectTrends key={studentId} data={trends.data} />}
      </Quiet>
      {only !== 'trends' && (
        <>
          {trends.data && <StrengthsRadar data={trends.data} termId={termId} />}
          <AssessmentTypes studentId={studentId} termId={termId} />
          <MarksInTerm idKey={studentId} load={() => api.charts({ chart: 'marks', scope: 'student', id: studentId, ...(termId ? { term: termId } : {}) })} deps={[studentId, termId]} />
          <RankOverTime load={() => api.charts({ chart: 'ranks', scope: 'student', id: studentId })} deps={[studentId]} />
        </>
      )}
    </ScaleContext.Provider>
  )
}

// Parents (and a student's own account): only what their child's other pages already show. Subject results for
// terms with a finalized report, every mark (without assessment types), and positions only where the report card
// has them. No class comparisons.
export function ChildCharts({ studentId, terms }) {
  const words = useVocab()
  const [term, setTerm] = useState(terms[terms.length - 1]?.id || '')
  const trends = useChart(() => api.guardianStudents.charts(studentId, { chart: 'subject_trends' }), [studentId])
  return (
    <>
      <Quiet state={trends}>
        {trends.data && (trends.data.terms.length ? (
          <>
            <SubjectTrends data={trends.data} allowCompare={false} />
            <StrengthsRadar data={trends.data} allowCompare={false} />
          </>
        ) : <p className="hint">{words.subjects} over time appear once the school shares a finalized report.</p>)}
      </Quiet>
      {terms.length > 0 && (
        <>
          <div className="field" style={{ maxWidth: 260, marginTop: 12 }}>
            <label htmlFor={`child-term-${studentId}`}>{words.term} for the marks chart</label>
            <select id={`child-term-${studentId}`} value={term} onChange={(e) => setTerm(e.target.value)}>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <MarksInTerm idKey={`child-${studentId}`} showTypes={false} load={() => api.guardianStudents.charts(studentId, { chart: 'marks', term })} deps={[studentId, term]} />
        </>
      )}
      <RankOverTime quietWhenUnranked load={() => api.guardianStudents.charts(studentId, { chart: 'ranks' })} deps={[studentId]} />
    </>
  )
}

import { useEffect, useState } from 'react'
import { useSchoolLevels, useWithLevel } from '../levels.js'
import { api } from '../api.js'
import { BENCHMARK, BarChart, CATEGORICAL, COMPARE, ColumnChart, LineChart } from './charts.jsx'

const SCOPES = [
  { key: 'student', label: 'Student' },
  { key: 'class', label: 'Class' },
  { key: 'year_group', label: 'Year group' },
  { key: 'school', label: 'Whole school', adminOnly: true },
]


function Change({ value }) {
  if (value == null) return <span className="text-muted">—</span>
  if (value === 0) return <span>no change</span>
  // Arrow and sign, so the direction never depends on colour alone.
  return value > 0 ? <span className="change-up">▲ +{value}</span> : <span className="change-down">▼ {value}</span>
}

function ChartCard({ title, hint, children, table }) {
  const [showTable, setShowTable] = useState(false)
  return (
    <div className="card">
      <div className="panel-header" style={{ marginBottom: 4 }}>
        <h3 style={{ fontSize: 15 }}>{title}</h3>
        {table && (
          <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => setShowTable(!showTable)}>
            {showTable ? 'Show chart' : 'Show as table'}
          </button>
        )}
      </div>
      {hint && <p className="hint" style={{ marginTop: 0 }}>{hint}</p>}
      {showTable ? <div className="table-scroll">{table}</div> : children}
    </div>
  )
}

function TrendTable({ data, series }) {
  const fmt = useWithLevel()
  return (
    <table>
      <thead><tr><th>Term</th>{series.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
      <tbody>{data.map((d) => <tr key={d.term}><td>{d.term}</td>{series.map((s) => <td key={s.key}>{fmt(d[s.key], 1)}</td>)}</tr>)}</tbody>
    </table>
  )
}

function RowsTable({ rows, bars }) {
  const fmt = useWithLevel()
  return (
    <table>
      <thead><tr><th /> {bars.map((b) => <th key={b.key}>{b.label}</th>)}</tr></thead>
      <tbody>{rows.map((r) => <tr key={r.label}><td>{r.label}</td>{bars.map((b) => <td key={b.key}>{fmt(r[b.key], 1)}</td>)}</tr>)}</tbody>
    </table>
  )
}

function BandsTable({ bands }) {
  const levels = useSchoolLevels()
  const name = (band) => levels.find((l) => l.code === band)?.name
  return (
    <table>
      <thead><tr><th>{levels.length ? 'Level' : 'Average'}</th><th>Students</th></tr></thead>
      <tbody>{bands.map((b) => <tr key={b.band}><td>{b.band}{name(b.band) && <span className="text-muted"> ({name(b.band)})</span>}</td><td>{b.students}</td></tr>)}</tbody>
    </table>
  )
}

function StudentTable({ students, showClass, onOpenStudent }) {
  const fmt = useWithLevel()
  const [showAll, setShowAll] = useState(false)
  if (!students?.length) return null
  const LIMIT = 15
  const shown = showAll ? students : students.slice(0, LIMIT)
  return (
    <div className="card">
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Students, highest average first</h3>
      <div className="table-scroll">
      <table>
        <thead>
          <tr><th>#</th><th>Student</th>{showClass && <th>Class</th>}<th>Average</th><th>Previous term</th><th>Change</th></tr>
        </thead>
        <tbody>
          {shown.map((s, i) => (
            <tr key={s.id}>
              <td className="text-muted">{s.average == null ? '—' : i + 1}</td>
              <td>
                <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: 0 }} onClick={() => onOpenStudent(s.id)}>
                  {s.name}
                </button>
              </td>
              {showClass && <td>{s.class_name || '—'}</td>}
              <td><strong>{fmt(s.average, 1)}</strong></td>
              <td>{fmt(s.previous, 1)}</td>
              <td><Change value={s.change} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      {students.length > LIMIT && (
        <button type="button" className="secondary" style={{ marginTop: 12 }} onClick={() => setShowAll(!showAll)}>
          {showAll ? `Show top ${LIMIT} only` : `Show all ${students.length} students`}
        </button>
      )}
    </div>
  )
}

// Performance graphs for one student, a class, a year group, or the school.
export default function Performance({ me }) {
  const isAdmin = me?.role === 'admin'
  const [scope, setScope] = useState('class')
  const [classes, setClasses] = useState([])
  const [yearGroups, setYearGroups] = useState([])
  const [students, setStudents] = useState([])
  const [target, setTarget] = useState({ student: '', class: '', year_group: '' })
  const [term, setTerm] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.schoolClasses.list(), api.yearGroups.list(), api.students.list({ is_active: true })])
      .then(([cls, years, studs]) => {
        const assigned = new Set((me?.assignments || []).map((a) => a.school_class))
        const myClasses = isAdmin ? cls : cls.filter((c) => assigned.has(c.id))
        const myYears = isAdmin ? years : years.filter((y) => myClasses.some((c) => c.year_group === y.id))
        setClasses(myClasses)
        setYearGroups(myYears)
        setStudents(studs.sort((a, b) => `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)))
        // Keep what the user already picked if the lists are reloaded.
        const pick = (current, list) =>
          list.some((x) => String(x.id) === current) ? current : list[0] ? String(list[0].id) : ''
        setTarget((t) => ({
          student: pick(t.student, studs),
          class: pick(t.class, myClasses),
          year_group: pick(t.year_group, myYears),
        }))
      })
      .catch((err) => setError(err.message))
  }, [isAdmin, me])

  const id = scope === 'school' ? '' : target[scope]

  useEffect(() => {
    if (scope !== 'school' && !id) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    api.performance({ scope, id, term })
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && (setError(err.message), setData(null)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [scope, id, term])

  function openStudent(studentId) {
    setScope('student')
    setTarget((t) => ({ ...t, student: String(studentId) }))
  }

  const picker = {
    student: { label: 'Student', options: students.map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}` })) },
    class: { label: 'Class', options: classes },
    year_group: { label: 'Year group', options: yearGroups },
  }[scope]
  const termName = data?.terms?.find((t) => t.id === data.term)?.name

  return (
    <div>
      <div className="panel-header">
        <h2>Performance</h2>
      </div>

      <div className="scope-tabs filter-row" role="tablist">
        {SCOPES.filter((s) => !s.adminOnly || isAdmin).map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={scope === s.key}
            className={`secondary${scope === s.key ? ' active' : ''}`} onClick={() => { setScope(s.key); setTerm('') }}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="form-row">
          {picker && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="perf-target">{picker.label}</label>
              <select id="perf-target" value={target[scope]} onChange={(e) => setTarget({ ...target, [scope]: e.target.value })}>
                {picker.options.length === 0 && <option value="">None available</option>}
                {picker.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="perf-term">Term (for subject and spread charts)</label>
            <select id="perf-term" value={term || data?.term || ''} onChange={(e) => setTerm(e.target.value)} disabled={!data?.terms?.length}>
              {(data?.terms || []).map((t) => <option key={t.id} value={t.id}>{t.name}{t.is_locked ? ' (locked)' : ''}</option>)}
            </select>
          </div>
        </div>
        <p className="hint" style={{ marginBottom: 0 }}>
          A student's average is the mean of their subject percentages for the term. Group averages are the mean of their
          students' averages, so every student counts equally.
        </p>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && !data && <p className="text-muted">Loading…</p>}
      {data && !data.terms.length && (
        <div className="empty-state"><h3>No grades yet</h3><p>Charts appear once grades are recorded.</p></div>
      )}

      {data && data.terms.length > 0 && <Charts data={data} termName={termName} onOpenStudent={openStudent} />}
    </div>
  )
}

function Charts({ data, termName, onOpenStudent }) {
  const byLevel = useSchoolLevels().length > 0
  if (data.scope === 'student') {
    const series = [
      { key: 'student', label: data.name, color: COMPARE[0] },
      { key: 'class', label: 'Class average', short: 'Class', color: COMPARE[1] },
      { key: 'year_group', label: 'Year group average', short: 'Year group', color: COMPARE[2] },
    ]
    const bars = [{ key: 'student', label: data.name, color: COMPARE[0] }, { key: 'class', label: 'Class average', color: COMPARE[1] }]
    const rows = data.subjects.map((s) => ({ label: s.subject, student: s.student, class: s.class }))
    return (
      <div className="perf-grid">
        <ChartCard title="Average by term" hint={`${data.name}${data.class_name ? `, ${data.class_name}` : ''}, against their class and year group.`}
          table={<TrendTable data={data.trend} series={series} />}>
          <LineChart data={data.trend} series={series} label={`${data.name} average by term`} />
        </ChartCard>
        <ChartCard title={`Subjects, ${termName}`} hint="Each subject against the class average." table={<RowsTable rows={rows} bars={bars} />}>
          <BarChart rows={rows} bars={bars} label={`${data.name} by subject, ${termName}`} />
        </ChartCard>
      </div>
    )
  }

  const isYear = data.scope === 'year_group'
  const isSchool = data.scope === 'school'
  const groupWord = isSchool ? 'year group' : 'class'

  let trendSeries
  if (data.scope === 'class') {
    trendSeries = [
      { key: 'class', label: data.name, color: COMPARE[0] },
      { key: 'year_group', label: `${data.year_group_name} average`, short: data.year_group_name, color: COMPARE[1] },
      { key: 'school', label: 'School average', short: 'School', color: BENCHMARK, dashed: true },
    ]
  } else {
    // One colour per class (or year group), in a fixed order, plus a dashed benchmark.
    trendSeries = [
      ...data.series.slice(0, CATEGORICAL.length).map((s, i) => ({ ...s, color: CATEGORICAL[i] })),
      isYear
        ? { key: 'year_group', label: `${data.name} average`, short: 'Year avg', color: BENCHMARK, dashed: true }
        : { key: 'school', label: 'School average', short: 'School', color: BENCHMARK, dashed: true },
    ]
  }

  const subjectBars = data.scope === 'class'
    ? [{ key: 'class', label: data.name, color: COMPARE[0] }, { key: 'year_group', label: `${data.year_group_name} average`, color: COMPARE[1] }]
    : isYear
      ? [{ key: 'year_group', label: data.name, color: COMPARE[0] }, { key: 'school', label: 'School average', color: COMPARE[1] }]
      : [{ key: 'school', label: 'School', color: COMPARE[0] }]
  // Only subjects this group actually takes; the comparison is just context.
  const subjectRows = data.subjects.filter((s) => s[subjectBars[0].key] != null).map((s) => ({ label: s.subject, ...s }))
  const groupRows = (data.groups || []).map((g) => ({ label: g.name, average: g.average, note: `${g.students} students` }))
  const groupBar = [{ key: 'average', label: 'Average', color: COMPARE[0] }]

  return (
    <>
      <div className="perf-grid">
        <ChartCard
          title="Average by term"
          hint={data.scope === 'class' ? `${data.name} (${data.students_count} students) against its year group and the school.` : `Each ${groupWord} over time. The dashed line is the ${isYear ? 'year group' : 'school'} average.`}
          table={<TrendTable data={data.trend} series={trendSeries} />}
        >
          <LineChart data={data.trend} series={trendSeries} label={`${data.name} average by term`} />
        </ChartCard>

        {(isYear || isSchool) && (
          <ChartCard title={`${isSchool ? 'Year groups' : 'Classes'}, ${termName}`} hint={`Average for each ${groupWord} this term.`}
            table={<RowsTable rows={groupRows} bars={groupBar} />}>
            <BarChart rows={groupRows} bars={groupBar} label={`Average by ${groupWord}, ${termName}`} />
          </ChartCard>
        )}

        <ChartCard title={`Subjects, ${termName}`} hint={subjectBars.length > 1 ? `Each subject against the ${subjectBars[1].label.toLowerCase()}.` : 'Average in each subject.'}
          table={<RowsTable rows={subjectRows} bars={subjectBars} />}>
          <BarChart rows={subjectRows} bars={subjectBars} label={`Subjects, ${termName}`} />
        </ChartCard>

        <ChartCard title={`${byLevel ? 'Students at each level' : 'Spread of averages'}, ${termName}`}
          hint={byLevel ? "How many students' averages are at each CBC level." : "How many students' averages fall in each band."}
          table={<BandsTable bands={data.distribution} />}>
          <ColumnChart bands={data.distribution} label={`Spread of student averages, ${termName}`} />
        </ChartCard>
      </div>
      <div style={{ marginTop: 18 }}>
        <StudentTable students={data.students} showClass={isYear} onOpenStudent={onOpenStudent} />
      </div>
    </>
  )
}

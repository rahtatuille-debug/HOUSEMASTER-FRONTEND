import { COMPARE, LineChart } from './charts.jsx'

// A student's average each term next to their class and year group.
// Series without data (e.g. no class averages for parents) are left out.
const SERIES = [
  { key: 'student', label: 'Student', color: COMPARE[0] },
  { key: 'class', label: 'Class average', short: 'Class', color: COMPARE[1] },
  { key: 'year_group', label: 'Year group average', short: 'Year group', color: COMPARE[2] },
]

export default function PerformanceChart({ data }) {
  return (
    <LineChart
      data={data || []}
      series={SERIES}
      label={`Average score by term: ${(data || []).map((d) => `${d.term} ${d.student ?? 'no grades'}%`).join('; ')}`}
    />
  )
}

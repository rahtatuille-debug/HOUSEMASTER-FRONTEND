import { useState } from 'react'

// Student vs class vs year-group average, per term. Colours were checked
// with the dataviz palette validator (lightness, chroma, colour-blind
// separation and contrast on the white card).
const SERIES = [
  { key: 'student', label: 'Student', color: '#3565c4' },
  { key: 'class', label: 'Class average', color: '#c08a1e' },
  { key: 'year_group', label: 'Year group average', color: '#17907d' },
]

const W = 640
const H = 260
const PAD = { top: 16, right: 96, bottom: 36, left: 40 }

export default function PerformanceChart({ data }) {
  const [hover, setHover] = useState(null)
  if (!data || data.length === 0) {
    return <p className="text-muted" style={{ margin: 0 }}>No grades recorded yet.</p>
  }

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const step = data.length > 1 ? plotW / (data.length - 1) : 0
  const x = (i) => PAD.left + (data.length > 1 ? i * step : plotW / 2)
  const y = (v) => PAD.top + plotH - (v / 100) * plotH
  const series = SERIES.filter((s) => data.some((d) => d[s.key] != null))

  function path(key) {
    let d = ''
    data.forEach((row, i) => {
      if (row[key] == null) return
      d += `${d ? 'L' : 'M'}${x(i)},${y(row[key])}`
    })
    return d
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = data.length > 1 ? Math.round((px - PAD.left) / step) : 0
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }

  // Direct labels at each line's last point, nudged apart if they'd overlap.
  const endLabels = series
    .map((s) => {
      const last = [...data.keys()].reverse().find((i) => data[i][s.key] != null)
      return { ...s, i: last, yPos: y(data[last][s.key]) }
    })
    .sort((a, b) => a.yPos - b.yPos)
  for (let k = 1; k < endLabels.length; k++) {
    if (endLabels[k].yPos - endLabels[k - 1].yPos < 14) endLabels[k].yPos = endLabels[k - 1].yPos + 14
  }

  const hovered = hover !== null ? data[hover] : null

  return (
    <div className="perf-chart">
      <div className="chart-legend" aria-hidden="true">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`Average score by term: ${data
            .map((d) => `${d.term} student ${d.student ?? 'no grades'}%`)
            .join('; ')}`}
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="#ece6d8" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="chart-axis">
                {v}%
              </text>
            </g>
          ))}
          {data.map((d, i) => (
            <text key={d.term} x={x(i)} y={H - 12} textAnchor="middle" className="chart-axis">
              {d.term}
            </text>
          ))}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#b9b09a" strokeWidth="1" />
          )}
          {series.map((s) => (
            <g key={s.key}>
              <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) =>
                d[s.key] == null ? null : (
                  <circle key={i} cx={x(i)} cy={y(d[s.key])} r={hover === i ? 5 : 4} fill={s.color} stroke="#fff" strokeWidth="2" />
                )
              )}
            </g>
          ))}
          {endLabels.map((s) => (
            <text key={s.key} x={x(s.i) + 10} y={s.yPos + 4} className="chart-label">
              {s.label === 'Student' ? 'Student' : s.label.replace(' average', '')}
            </text>
          ))}
        </svg>
        {hovered && (
          <div
            className="chart-tooltip"
            style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > data.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}
          >
            <strong>{hovered.term}</strong>
            {series.map((s) => (
              <div key={s.key}>
                <i style={{ background: s.color }} /> {s.label}: {hovered[s.key] == null ? '—' : `${hovered[s.key]}%`}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

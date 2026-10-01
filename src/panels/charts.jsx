import { useState } from 'react'
import { useWithLevel } from '../levels.js'

// Colours checked with the dataviz palette validator against the white card.
// COMPARE: a student/class against wider averages (3 slots, all pairs pass).
// CATEGORICAL: one colour per class or year group, in this fixed order, so a
// class keeps its colour (up to 8 lines; lighter slots always carry labels).
export const COMPARE = ['#3565c4', '#c08a1e', '#17907d']
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
// Benchmark lines (e.g. whole-school average) are neutral ink and dashed, so
// they read as a reference, not another group.
export const BENCHMARK = '#52514e'


function Legend({ series }) {
  return (
    <div className="chart-legend" aria-hidden="true">
      {series.map((s) => (
        <span key={s.key}>
          <i style={{ background: s.dashed ? 'transparent' : s.color, border: s.dashed ? `2px dashed ${s.color}` : 'none', boxSizing: 'border-box' }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

// Average by term, one line per series. data: [{ term, [series.key]: number|null }]
export function LineChart({ data, series, label }) {
  const fmt = useWithLevel()
  const [hover, setHover] = useState(null)
  const shown = series.filter((s) => data.some((d) => d[s.key] != null))
  if (!data.length || !shown.length) return <p className="text-muted" style={{ margin: 0 }}>No grades recorded yet.</p>
  const labelEvery = data.length <= 6 ? 1 : Math.ceil(data.length / 3)

  const W = 640
  const H = 260
  const PAD = { top: 16, right: 110, bottom: 36, left: 40 }
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const step = data.length > 1 ? plotW / (data.length - 1) : 0
  const x = (i) => PAD.left + (data.length > 1 ? i * step : plotW / 2)
  const y = (v) => PAD.top + plotH - (v / 100) * plotH

  const path = (key) => {
    let d = ''
    data.forEach((row, i) => {
      if (row[key] == null) return
      d += `${d ? 'L' : 'M'}${x(i)},${y(row[key])}`
    })
    return d
  }

  const ends = shown
    .map((s) => {
      const last = [...data.keys()].reverse().find((i) => data[i][s.key] != null)
      return { ...s, i: last, yPos: y(data[last][s.key]) }
    })
    .sort((a, b) => a.yPos - b.yPos)
  for (let k = 1; k < ends.length; k++) {
    if (ends[k].yPos - ends[k - 1].yPos < 14) ends[k].yPos = ends[k - 1].yPos + 14
  }

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    const i = data.length > 1 ? Math.round((px - PAD.left) / step) : 0
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }
  const hovered = hover != null ? data[hover] : null

  return (
    <div className="perf-chart">
      <Legend series={shown} />
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} stroke="#ece6d8" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" className="chart-axis">{v}%</text>
            </g>
          ))}
          {data.map((d, i) => (i === data.length - 1 || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery)) && (
            // Years of terms don't fit: label every few, plus the latest (hovering shows each one).
            <text key={i} x={x(i)} y={H - 12} className="chart-axis"
              textAnchor={data.length > 1 && i === 0 ? 'start' : data.length > 1 && i === data.length - 1 ? 'end' : 'middle'}>
              {d.term}
            </text>
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="#b9b09a" strokeWidth="1" />}
          {shown.map((s) => (
            <g key={s.key}>
              <path d={path(s.key)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dashed ? '6 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) =>
                d[s.key] == null ? null : (
                  <circle key={i} cx={x(i)} cy={y(d[s.key])} r={hover === i ? 5 : 4} fill={s.dashed ? '#fff' : s.color} stroke={s.dashed ? s.color : '#fff'} strokeWidth="2" />
                )
              )}
            </g>
          ))}
          {ends.map((s) => (
            <text key={s.key} x={x(s.i) + 10} y={s.yPos + 4} className="chart-label">{s.short || s.label}</text>
          ))}
        </svg>
        {hovered && (
          <div className="chart-tooltip" style={{ left: `${(x(hover) / W) * 100}%`, transform: hover > data.length / 2 ? 'translateX(calc(-100% - 12px))' : 'translateX(12px)' }}>
            <strong>{hovered.term}</strong>
            {shown.map((s) => (
              <div key={s.key}><i style={{ background: s.color }} /> {s.label}: {fmt(hovered[s.key])}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Horizontal bars, 0–100%. rows: [{ label, [bar.key]: number|null }]; up to 2 bars per row.
export function BarChart({ rows, bars, label }) {
  const fmt = useWithLevel()
  const [hover, setHover] = useState(null)
  if (!rows.length) return <p className="text-muted" style={{ margin: 0 }}>Nothing to show for this term.</p>
  const shown = bars.filter((b) => rows.some((r) => r[b.key] != null))
  const barH = 12
  const gap = 2
  const rowH = shown.length * barH + (shown.length - 1) * gap + 14
  const W = 640
  const LABEL = 150
  const VALUE = 72 // room for "100% · EE1"
  const plotW = W - LABEL - VALUE
  const H = rows.length * rowH + 24
  const xw = (v) => (Math.max(0, Math.min(100, v)) / 100) * plotW

  return (
    <div className="perf-chart">
      {shown.length > 1 && <Legend series={shown} />}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={LABEL + xw(v)} x2={LABEL + xw(v)} y1={0} y2={H - 20} stroke="#ece6d8" strokeWidth="1" />
              <text x={LABEL + xw(v)} y={H - 6} textAnchor="middle" className="chart-axis">{v}%</text>
            </g>
          ))}
          {rows.map((r, i) => {
            const top = i * rowH + 6
            return (
              <g key={r.label} onMouseEnter={() => setHover(i)}>
                <rect x={0} y={top - 4} width={W} height={rowH} fill={hover === i ? '#f7f3ea' : 'transparent'} />
                <text x={LABEL - 10} y={top + (rowH - 14) / 2 + 4} textAnchor="end" className="chart-label">
                  {r.label.length > 20 ? `${r.label.slice(0, 19)}…` : r.label}
                </text>
                {shown.map((b, k) => {
                  const v = r[b.key]
                  if (v == null) return null
                  const w = Math.max(xw(v), 2)
                  const yb = top + k * (barH + gap)
                  return (
                    <g key={b.key}>
                      {/* Square at the baseline, 4px round at the data end. */}
                      <path d={`M${LABEL},${yb} h${Math.max(w - 4, 0)} a4,4 0 0 1 4,4 v${barH - 8} a4,4 0 0 1 -4,4 h${-Math.max(w - 4, 0)} z`} fill={b.color} />
                      {k === 0 && <text x={LABEL + w + 6} y={yb + barH - 2} className="chart-value">{fmt(v)}</text>}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
        {hover != null && (
          <div className="chart-tooltip" style={{ top: `${((hover * rowH + 6) / H) * 100}%`, left: '40%' }}>
            <strong>{rows[hover].label}</strong>
            {shown.map((b) => (
              <div key={b.key}><i style={{ background: b.color }} /> {b.label}: {fmt(rows[hover][b.key])}</div>
            ))}
            {rows[hover].note && <div className="text-muted">{rows[hover].note}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

// Vertical columns for a count per band. bands: [{ band, students }]
export function ColumnChart({ bands, label }) {
  const [hover, setHover] = useState(null)
  const total = bands.reduce((a, b) => a + b.students, 0)
  if (!total) return <p className="text-muted" style={{ margin: 0 }}>No grades this term.</p>
  const W = 640
  const H = 220
  const PAD = { top: 22, bottom: 34, left: 8, right: 8 }
  const plotH = H - PAD.top - PAD.bottom
  const slot = (W - PAD.left - PAD.right) / bands.length
  const colW = Math.min(56, slot - 12)
  const max = Math.max(...bands.map((b) => b.students), 1)
  return (
    <div className="perf-chart">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#b9b09a" strokeWidth="1" />
        {bands.map((b, i) => {
          const h = b.students ? Math.max((b.students / max) * plotH, 4) : 0
          const cx = PAD.left + slot * i + slot / 2
          const top = PAD.top + plotH - h
          return (
            <g key={b.band} onMouseEnter={() => setHover(i)}>
              <rect x={cx - slot / 2} y={PAD.top} width={slot} height={plotH} fill={hover === i ? '#f7f3ea' : 'transparent'} />
              {h > 0 && (
                <path d={`M${cx - colW / 2},${PAD.top + plotH} v${-(h - 4)} a4,4 0 0 1 4,-4 h${colW - 8} a4,4 0 0 1 4,4 v${h - 4} z`} fill={COMPARE[0]} />
              )}
              <text x={cx} y={top - 6} textAnchor="middle" className="chart-value">{b.students}</text>
              <text x={cx} y={H - 12} textAnchor="middle" className="chart-axis">{b.band}</text>
            </g>
          )
        })}
      </svg>
      {hover != null && (
        <p className="hint" style={{ margin: '4px 0 0' }}>
          {bands[hover].band}: {bands[hover].students} student{bands[hover].students === 1 ? '' : 's'} ({Math.round((bands[hover].students / total) * 100)}%)
        </p>
      )}
    </div>
  )
}

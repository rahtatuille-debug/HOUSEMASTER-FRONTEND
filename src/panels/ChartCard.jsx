import { useState } from 'react'

// A chart with its title, a short explanation, and the same numbers as a table (for screen readers and anyone
// who prefers one). `actions`: controls shown under the hint (selectors, toggles).
export default function ChartCard({ title, hint, children, table, actions }) {
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
      {actions}
      {showTable ? <div className="table-scroll">{table}</div> : children}
    </div>
  )
}

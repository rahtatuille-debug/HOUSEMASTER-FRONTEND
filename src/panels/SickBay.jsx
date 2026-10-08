import { SickBayPanel } from './Boarding.jsx'

// The school nurse's sick bay: every student, day students included.
export default function SickBay() {
  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Sick bay</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>Check students in and out, note what was given, and tell parents.</p>
        </div>
      </div>
      <SickBayPanel everyone />
    </div>
  )
}

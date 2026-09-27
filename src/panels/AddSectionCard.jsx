import { useEffect, useState } from 'react'
import { api } from '../api.js'

// For a school running two systems, e.g. a CBC school with a British IGCSE
// section: pick the other curriculum and its stages, and HouseMaster adds
// those year groups (after the school's own) with their own grading, report
// cards and AI writing.
const SYSTEM_NAMES = { cbc: 'CBC', 844: '8-4-4', british: 'British', ib: 'IB', american: 'American' }

export default function AddSectionCard({ school, scales, onDone }) {
  const [catalogue, setCatalogue] = useState(null)
  const [open, setOpen] = useState(false)
  const [system, setSystem] = useState('')
  const [stages, setStages] = useState([])
  const [scale, setScale] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (open && !catalogue) api.setup.state().then(setCatalogue).catch((err) => setError(err.message))
  }, [open, catalogue])

  const chosen = catalogue?.systems.find((s) => s.key === system)
  const picked = chosen ? chosen.stages.filter((s) => stages.includes(s.key)) : []
  const yearGroups = picked.flatMap((s) => s.year_groups)
  const subjects = [...new Set(picked.flatMap((s) => s.subjects))]

  function pickSystem(key) {
    const next = catalogue.systems.find((s) => s.key === key)
    setSystem(key)
    setStages([])
    setScale(next ? next.scales[0] : '')
  }

  function toggleStage(key) {
    setStages((list) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]))
  }

  async function add() {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const { created } = await api.setup.addSection({
        education_system: system, grading_scale: scale, subjects,
        year_groups: yearGroups.map((name) => ({ name, classes: [name] })),
      })
      setNotice(`Added the ${chosen.name} section: ${created.year_groups} year groups, ${created.classes} classes and `
        + `${created.subjects} new subjects. Rename classes or add streams below.`)
      setSystem('')
      setStages([])
      onDone?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Another curriculum</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Running two systems, such as a British IGCSE section alongside {SYSTEM_NAMES[school?.education_system] || 'your main one'}?
        Add the other section here. Its year groups get their own grading, report cards and AI writing. You can also
        change the curriculum of an existing year group in the table above.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      {!open ? (
        <button type="button" className="secondary" onClick={() => setOpen(true)}>Add another curriculum</button>
      ) : !catalogue ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="form-row">
            <div className="field">
              <label htmlFor="section-system">Curriculum</label>
              <select id="section-system" value={system} onChange={(e) => pickSystem(e.target.value)}>
                <option value="">Select…</option>
                {catalogue.systems.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
            </div>
            {chosen && (
              <div className="field">
                <label htmlFor="section-scale">Grading</label>
                <select id="section-scale" value={scale} onChange={(e) => setScale(e.target.value)}>
                  {chosen.scales.map((key) => (
                    <option key={key} value={key}>{scales.find((s) => s.key === key)?.label || key}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {chosen && (
            <fieldset style={{ border: 0, padding: 0, margin: '4px 0 12px' }}>
              <legend className="hint" style={{ marginBottom: 6 }}>Which stages does this section teach?</legend>
              {chosen.stages.map((s) => (
                <label key={s.key} style={{ display: 'block', fontWeight: 'normal', textTransform: 'none', letterSpacing: 0, fontSize: 14, marginBottom: 4 }}>
                  <input type="checkbox" style={{ width: 'auto', marginRight: 6 }} checked={stages.includes(s.key)}
                    onChange={() => toggleStage(s.key)} />
                  {s.name} <span className="text-muted">({s.year_groups.join(', ')})</span>
                </label>
              ))}
            </fieldset>
          )}
          {yearGroups.length > 0 && (
            <p className="hint">
              Adds {yearGroups.length} year groups ({yearGroups.join(', ')}), one class in each, and any of these
              subjects you don't have yet: {subjects.join(', ')}.
            </p>
          )}
          <div className="form-actions">
            <button type="button" onClick={add} disabled={busy || !yearGroups.length}>{busy ? 'Adding…' : 'Add section'}</button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </>
      )}
    </div>
  )
}

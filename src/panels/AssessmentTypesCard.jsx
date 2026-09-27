import { useEffect, useState } from 'react'
import { api, needsApproval } from '../api.js'
import { useVocab } from '../levels.js'

// How marks are weighted into a subject's result, e.g. CAT 30% and
// End-term exam 70%. Teachers' changes go to an admin for approval.
export default function AssessmentTypesCard({ me }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [types, setTypes] = useState([])
  const [form, setForm] = useState({ name: '', weight: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = () => api.assessmentTypes.list().then(setTypes).catch((err) => setError(err.message))
  useEffect(() => { load() }, [])

  async function run(action, done) {
    setError('')
    setNotice('')
    try {
      const result = await action()
      setNotice(needsApproval(result) ? 'Sent to an admin for approval. You can follow it under My requests.' : done)
      load()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  async function add(e) {
    e.preventDefault()
    if (!form.name.trim() || form.weight === '') return
    if (await run(() => api.assessmentTypes.create({ name: form.name.trim(), weight: form.weight, order: types.length }),
      `Added ${form.name.trim()}.`)) setForm({ name: '', weight: '' })
  }

  const total = types.reduce((sum, t) => sum + Number(t.weight), 0)

  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Assessment types</h3>
      <p className="hint" style={{ marginTop: 0 }}>
        Each mark can be tagged with a type. A {words.subject.toLowerCase()}'s {words.term.toLowerCase()} result
        averages each type's marks, then combines them by these weights, counting only the types that have marks so
        far. With no types, all marks are simply averaged.
      </p>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      {types.length > 0 && (
        <table style={{ marginBottom: 12 }}>
          <thead><tr><th>Type</th><th>Weight</th><th /></tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{Number(t.weight)}%</td>
                <td style={{ textAlign: 'right' }}>
                  <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: '0 6px' }}
                    onClick={() => window.confirm(`Delete ${t.name}? Its marks will count as untyped.`) &&
                      run(() => api.assessmentTypes.remove(t.id), `Deleted ${t.name}.`)}>
                    {isAdmin ? 'Delete' : 'Request delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td><strong>Total</strong></td><td><strong>{total}%</strong></td><td /></tr></tfoot>
        </table>
      )}
      {types.length > 0 && total !== 100 && (
        <p className="hint">The weights add up to {total}%. That's fine (they're scaled), but most schools use 100%.</p>
      )}
      <form onSubmit={add} className="form-row">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="at-name">New type</label>
          <input id="at-name" value={form.name} maxLength={60} placeholder="e.g. CAT" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="at-weight">Weight (%)</label>
          <input id="at-weight" type="number" min="0" max="100" step="1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
        </div>
        <button type="submit">{isAdmin ? 'Add type' : 'Ask to add type'}</button>
      </form>
    </div>
  )
}

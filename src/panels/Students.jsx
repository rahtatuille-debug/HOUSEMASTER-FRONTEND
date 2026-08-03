import { useEffect, useState } from 'react'
import { api } from '../api.js'

const emptyForm = { first_name: '', last_name: '', house: '', external_id: '' }

export default function Students() {
  const [students, setStudents] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const params = showInactive ? {} : { is_active: true }
      const data = await api.students.list(params)
      setStudents(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showInactive])

  function startEdit(student) {
    setEditingId(student.id)
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      house: student.house || '',
      external_id: student.external_id || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return
    try {
      if (editingId) {
        await api.students.update(editingId, form)
      } else {
        await api.students.create(form)
      }
      cancelEdit()
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleActive(student) {
    try {
      await api.students.update(student.id, { is_active: !student.is_active })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      <div className="panel-header">
        <h2>Students</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, textTransform: 'none' }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: 14, fontSize: 15 }}>
          {editingId ? 'Edit student' : 'Add a student'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="first-name">First name</label>
              <input
                id="first-name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="last-name">Last name</label>
              <input
                id="last-name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                required
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="house">House</label>
              <input
                id="house"
                value={form.house}
                onChange={(e) => setForm({ ...form, house: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="external-id">External ID</label>
              <input
                id="external-id"
                value={form.external_id}
                onChange={(e) => setForm({ ...form, external_id: e.target.value })}
                placeholder="from spreadsheet, optional"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit">{editingId ? 'Save changes' : 'Add student'}</button>
            {editingId && (
              <button type="button" className="secondary" onClick={cancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : students.length === 0 ? (
        <div className="empty-state">
          <h3>No students yet</h3>
          <p>Add your first student above.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>House</th>
              <th>External ID</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>{s.first_name} {s.last_name}</td>
                <td>{s.house || '—'}</td>
                <td className="mono">{s.external_id || '—'}</td>
                <td>
                  <span className={`badge ${s.is_active ? 'finalized' : 'draft'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={{ display: 'flex', gap: 8 }}>
                  <button className="secondary" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                  <button className="secondary" onClick={() => toggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

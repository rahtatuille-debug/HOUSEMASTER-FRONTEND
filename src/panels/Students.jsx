import { useEffect, useState } from 'react'
import { classesFor, perms } from '../permissions.js'
import { useRemembered } from '../remember.js'
import { usePagedList } from '../usePagedList.js'
import SubjectChoicesCard from './SubjectChoicesCard.jsx'
import { useVocab } from '../levels.js'
import { api, needsApproval } from '../api.js'
import StudentProfile from './StudentProfile.jsx'
import ShowMore, { PAGE } from './ShowMore.jsx'
import SupportBadge from './SupportBadge.jsx'

const emptyForm = { first_name: '', last_name: '', house: '', external_id: '', school_class: '' }

// Teachers only see and add students in the classes they teach. Deleting a
// student permanently (with all their grades, attendance and reports) is
// admin-only; a teacher's delete becomes a request for an admin to approve.
export default function Students({ me, navParams }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [notice, setNotice] = useState('')
  // The student whose profile is open, if any.
  // The dashboard's student search opens a profile straight away.
  const [openStudentId, setOpenStudentId] = useRemembered('panel.students.open', null, navParams?.studentId || null)
  const [allClasses, setAllClasses] = useState([])
  const [error, setError] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [showInactive, setShowInactive] = useState(false)
  // The add/edit form opens on demand, so the list comes first (especially on phones).
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [supportOnly, setSupportOnly] = useState(false)
  const [classFilter, setClassFilter] = useState('')
  const [limit, setLimit] = useState(PAGE)

  // What the server is asked to filter by. The search waits for a pause in typing.
  const [query, setQuery] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  // One page at a time from the server, searched and filtered there (E-1).
  const list = usePagedList((page) => api.students.page({
    ...(showInactive ? {} : { is_active: true }), ...(query ? { q: query } : {}),
    ...(classFilter ? { school_class: classFilter } : {}), ...(supportOnly ? { needs_support: 1 } : {}), ...page,
  }), [showInactive, query, classFilter, supportOnly])
  const loading = list.loading
  const load = list.reload

  useEffect(() => {
    api.schoolClasses.list().then(setAllClasses).catch((err) => setError(err.message))
  }, [])
  useEffect(() => { if (list.error) setError(list.error) }, [list.error])

  function startEdit(student) {
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setEditingId(student.id)
    setForm({
      first_name: student.first_name,
      last_name: student.last_name,
      house: student.house || '',
      external_id: student.external_id || '',
      school_class: student.school_class ? String(student.school_class) : '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) return
    const body = {
      ...form,
      school_class: form.school_class ? Number(form.school_class) : null,
    }
    try {
      if (editingId) {
        await api.students.update(editingId, body)
      } else {
        await api.students.create(body)
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

  async function removeStudent(student) {
    const name = `${student.first_name} ${student.last_name}`
    setError('')
    setNotice('')
    let reason
    if (isAdmin) {
      if (!window.confirm(`Permanently delete ${name}? This also deletes all their grades, attendance and reports, and can't be undone. To keep their history, deactivate them instead.`)) return
    } else {
      reason = window.prompt(`Ask an admin to permanently delete ${name}? You can add a reason (optional).`, '')
      if (reason === null) return
    }
    try {
      const result = await api.students.remove(student.id, reason?.trim())
      setNotice(needsApproval(result) ? `Sent to an admin for approval to delete ${name}.` : `${name} was deleted.`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  // Teachers can only put students in classes they teach.
  const classes = classesFor(me, allClasses, 'pastoral')

  // An older server sends the whole list and ignores the filters, so they are applied here instead.
  const needle = query.toLowerCase()
  const filtered = list.serverPaged ? list.rows : list.allRows.filter((s) => (!classFilter || String(s.school_class) === classFilter)
    && (!supportOnly || s.needs_support)
    && (!needle || `${s.first_name} ${s.last_name} ${s.external_id || ''}`.toLowerCase().includes(needle)))
  const total = list.serverPaged ? list.total : filtered.length
  const shown = list.serverPaged ? filtered : filtered.slice(0, limit)
  const anyStudents = total > 0 || query || classFilter || supportOnly

  const className = (id) => {
    if (!id) return '—'
    return allClasses.find((c) => c.id === id)?.name || `#${id}`
  }

  if (openStudentId) {
    return (
      <StudentProfile
        studentId={openStudentId}
        me={me}
        onBack={(message) => {
          setOpenStudentId(null)
          setNotice(message || '')
          load()
        }}
      />
    )
  }

  return (
    <div>
      <div className="panel-header">
        <h2>Students</h2>
        {!showForm && (
          <button type="button" style={{ width: 'auto' }} onClick={() => { setEditingId(null); setForm(emptyForm); setShowForm(true) }}>
            Add a student
          </button>
        )}
      </div>

      <div className="list-filters">
        <div className="field">
          <label htmlFor="student-search">Search</label>
          <input id="student-search" type="search" value={search} placeholder={`Name or ${words.student_id.toLowerCase()}`}
            onChange={(e) => { setSearch(e.target.value); setLimit(PAGE) }} />
        </div>
        <div className="field">
          <label htmlFor="student-class-filter">{words.class}</label>
          <select id="student-class-filter" value={classFilter} onChange={(e) => { setClassFilter(e.target.value); setLimit(PAGE) }}>
            <option value="">All {words.classes.toLowerCase()}</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', alignSelf: 'end', marginBottom: 14 }}>
          <input
            type="checkbox"
            style={{ width: 'auto' }}
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Show inactive
        </label>
        <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: 8, textTransform: 'none', alignSelf: 'end', marginBottom: 14 }}>
          <input type="checkbox" style={{ width: 'auto' }} checked={supportOnly}
            onChange={(e) => { setSupportOnly(e.target.checked); setLimit(PAGE) }} />
          Needs support only
        </label>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      {!isAdmin && classes.length === 0 && !loading && (
        <p className="hint" style={{ marginTop: 0 }}>
          You aren't assigned to any classes yet, so there are no students to show. Ask an admin to assign you.
        </p>
      )}

      {showForm && (
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
              <label htmlFor="student-class">{words.class}</label>
              <select
                id="student-class"
                value={form.school_class}
                onChange={(e) => setForm({ ...form, school_class: e.target.value })}
                required={!isAdmin}
              >
                <option value="">{isAdmin ? 'Unassigned' : 'Select…'}</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="house">Sports house</label>
              <input
                id="house"
                value={form.house}
                onChange={(e) => setForm({ ...form, house: e.target.value })}
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="external-id">{words.student_id}</label>
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
            <button type="button" className="secondary" onClick={cancelEdit}>
              {editingId ? 'Cancel' : 'Close'}
            </button>
          </div>
        </form>
      </div>
      )}

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : !anyStudents ? (
        <div className="empty-state">
          <h3>No students yet</h3>
          <p>Add your first student with the button above, or import them from Excel in Setup.</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-muted">No students match that search.</p>
      ) : (
        <>
        <table className="responsive-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>{words.class}</th>
              <th>Sports house</th>
              <th>{words.student_id}</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id}>
                <td className="row-title">
                  <button
                    type="button"
                    className="link-button"
                    style={{ display: 'inline', width: 'auto', padding: 0, textAlign: 'left' }}
                    onClick={() => setOpenStudentId(s.id)}
                  >
                    {s.first_name} {s.last_name}
                  </button>
                  {s.needs_support && <SupportBadge status="open" />}
                </td>
                <td data-label={words.class}>{className(s.school_class)}</td>
                <td data-label="Sports house">{s.house || '—'}</td>
                <td data-label={words.student_id} className="mono">{s.external_id || '—'}</td>
                <td data-label="Status">
                  <span className={`badge ${s.is_active ? 'finalized' : 'draft'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="row-actions" style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setOpenStudentId(s.id)}>View</button>
                  <button className="secondary" onClick={() => startEdit(s)}>
                    Edit
                  </button>
                  {/* On phones these two live on the student's profile, to keep each card short. */}
                  <button className="secondary desktop-only" onClick={() => toggleActive(s)}>
                    {s.is_active ? 'Deactivate' : 'Reactivate'}
                  </button>
                  <button className="danger desktop-only" onClick={() => removeStudent(s)}>
                    {isAdmin ? 'Delete' : 'Request delete'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <ShowMore shown={list.serverPaged ? shown.length : limit} total={total} noun="students"
          onMore={() => (list.serverPaged ? list.loadMore() : setLimit(limit + PAGE))} />
        </>
      )}
      <SubjectChoicesCard me={me} />
    </div>
  )
}

import { useState } from 'react'

// A student dropdown with a search box above it: type part of a name or an
// admission number and the list narrows; when only one student matches,
// they're chosen. Keeps the plain <select> underneath, so it works the same
// with a keyboard, a screen reader and on a phone.
export default function StudentSelect({ id, label, students, value, onChange, emptyLabel = 'Select…', required = false }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const name = (s) => `${s.first_name} ${s.last_name}`
  const matches = q
    ? students.filter((s) => name(s).toLowerCase().includes(q) || (s.external_id || '').toLowerCase().includes(q))
    : students
  // The chosen student stays in the list even when the search hides them.
  const chosen = students.find((s) => String(s.id) === String(value))
  const shown = chosen && !matches.includes(chosen) ? [chosen, ...matches] : matches

  function search(text) {
    setQuery(text)
    const t = text.trim().toLowerCase()
    if (!t) return
    const found = students.filter((s) => name(s).toLowerCase().includes(t) || (s.external_id || '').toLowerCase().includes(t))
    if (found.length === 1 && String(found[0].id) !== String(value)) onChange(String(found[0].id))
  }

  return (
    <div className="student-select">
      <label htmlFor={id}>{label}</label>
      {students.length > 8 && (
        <input type="search" className="student-search" aria-label={`Search ${label.toLowerCase()}`}
          placeholder="Type a name or admission number" value={query} onChange={(e) => search(e.target.value)} />
      )}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        <option value="">{q && matches.length === 0 ? 'No students match' : emptyLabel}</option>
        {shown.map((s) => (
          <option key={s.id} value={s.id}>
            {name(s)}{s.external_id ? ` (${s.external_id})` : ''}
          </option>
        ))}
      </select>
      {q && matches.length > 1 && <p className="hint" style={{ margin: '4px 0 0' }}>{matches.length} students match</p>}
    </div>
  )
}

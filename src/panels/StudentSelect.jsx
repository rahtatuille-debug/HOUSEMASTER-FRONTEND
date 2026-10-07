import { useState } from 'react'

// A student dropdown with a search box above it: type part of a name or an
// admission number and the list narrows; when only one student matches,
// they're chosen. Keeps the plain <select> underneath, so it works the same
// with a keyboard, a screen reader and on a phone.
//
// Students can be { first_name, last_name, external_id } or, as boarding
// lists send them, { name }. `describe` adds extra text after the name (e.g.
// the house), which the search also looks at.
export function studentLabel(s, describe) {
  const name = s.name || `${s.first_name} ${s.last_name}`
  const extra = describe ? describe(s) : ''
  return `${name}${s.external_id ? ` (${s.external_id})` : ''}${extra ? ` ${extra}` : ''}`
}

export default function StudentSelect({ id, label, students, value, onChange, emptyLabel = 'Select…', required = false, describe, placeholder = 'Type a name or admission number' }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const find = (text) => students.filter((s) => studentLabel(s, describe).toLowerCase().includes(text))
  const matches = q ? find(q) : students
  // The chosen student stays in the list even when the search hides them.
  const chosen = students.find((s) => String(s.id) === String(value))
  const shown = chosen && !matches.includes(chosen) ? [chosen, ...matches] : matches

  function search(text) {
    setQuery(text)
    const t = text.trim().toLowerCase()
    if (!t) return
    const found = find(t)
    if (found.length === 1 && String(found[0].id) !== String(value)) onChange(String(found[0].id))
  }

  return (
    <div className="student-select">
      <label htmlFor={id}>{label}</label>
      {students.length > 8 && (
        <input type="search" className="student-search" aria-label={`Search ${label.toLowerCase()}`}
          placeholder={placeholder} value={query} onChange={(e) => search(e.target.value)} />
      )}
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required={required}>
        <option value="">{q && matches.length === 0 ? 'No students match' : emptyLabel}</option>
        {shown.map((s) => (
          <option key={s.id} value={s.id}>{studentLabel(s, describe)}</option>
        ))}
      </select>
      {q && matches.length > 1 && <p className="hint" style={{ margin: '4px 0 0' }}>{matches.length} students match</p>}
    </div>
  )
}

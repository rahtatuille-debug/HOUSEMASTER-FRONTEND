import { createContext, useContext } from 'react'

// CBC performance levels. The school's scale comes from /api/me/ as
// school.levels: [{ min, code, name }], highest first. Schools on
// "percentages only" have no levels, so these helpers just show the percent.

export function levelFor(percent, school) {
  if (percent == null) return null
  return (school?.levels || []).find((band) => percent >= band.min) || null
}

// "72% · ME", or "72%" when the school has no levels.
export function withLevel(percent, school, digits = 0) {
  if (percent == null) return '—'
  const text = `${Number(percent).toFixed(digits)}%`
  const level = levelFor(percent, school)
  return level ? `${text} · ${level.code}` : text
}

// The signed-in user's school, provided once in App so any table can show levels.
export const SchoolContext = createContext(null)

// Returns a formatter: fmt(72.4) -> "72% · ME".
export function useWithLevel() {
  const school = useContext(SchoolContext)
  return (percent, digits = 0) => withLevel(percent, school, digits)
}

export function useSchoolLevels() {
  return useContext(SchoolContext)?.levels || []
}

// The school's own words for things ("Stream", "Learning area", "Semester"…).
const DEFAULT_VOCAB = {
  year_group: 'Year group', year_groups: 'Year groups', class: 'Class', classes: 'Classes',
  subject: 'Subject', subjects: 'Subjects', term: 'Term', terms: 'Terms', student_id: 'Admission no.',
}

export function vocabFor(school) {
  return { ...DEFAULT_VOCAB, ...(school?.vocab || {}) }
}

export function useVocab() {
  return vocabFor(useContext(SchoolContext))
}

export function useSchool() {
  return useContext(SchoolContext)
}

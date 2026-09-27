import { createContext, useContext } from 'react'

// CBC performance levels. The school's scale comes from /api/me/ as
// school.levels: [{ min, code, name }], highest first. Schools on
// "percentages only" have no levels, so these helpers just show the percent.

export function levelFor(percent, school) {
  if (percent == null) return null
  return (school?.levels || []).find((band) => percent >= band.min) || null
}

// The middle of a level's band, e.g. ME (50-79%) -> 65, for recording a level as a mark out of 100.
export function levelMidpoint(levels, code) {
  const i = levels.findIndex((l) => l.code === code)
  if (i < 0) return ''
  const top = i === 0 ? 100 : levels[i - 1].min
  return Math.round((levels[i].min + top) / 2)
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

// In a school running two curricula, a page about one section (a student, a
// class, a chart) sets that section's grading scale here, so every level shown
// inside it uses the right bands. Outside it, the school's own scale is used.
export const ScaleContext = createContext(null)

// The level bands for a grading scale at this school (or its own scale).
export function levelsForScale(school, scale) {
  return (scale && school?.scale_levels?.[scale]) || school?.levels || []
}

function useLevels(scale) {
  const school = useContext(SchoolContext)
  const inherited = useContext(ScaleContext)
  return levelsForScale(school, scale || inherited)
}

// Returns a formatter: fmt(72.4) -> "72% · ME". Pass a scale to use that section's levels.
export function useWithLevel(scale) {
  const levels = useLevels(scale)
  return (percent, digits = 0) => withLevel(percent, { levels }, digits)
}

export function useSchoolLevels(scale) {
  return useLevels(scale)
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

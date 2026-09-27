// Dates in the school's local style (e.g. 27/09/2026 in Kenya and the UK,
// 9/27/2026 in the US). App sets the locale once the school is known.
let locale

export function setDateLocale(value) {
  locale = value || undefined
}

export function formatDate(value, options) {
  if (!value) return ''
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00`) : new Date(value)
  return date.toLocaleDateString(locale, options)
}

export function formatDateTime(value, options) {
  if (!value) return ''
  return new Date(value).toLocaleString(locale, options)
}

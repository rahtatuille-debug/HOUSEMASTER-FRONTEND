// What the app offers this staff member, from /api/me/ `permissions`
// (the server checks every request again). An older server sends no
// permissions, so fall back to the plain admin/teacher split.

export function perms(me) {
  const admin = me?.role === 'admin'
  return {
    is_admin: admin,
    is_leader: admin,
    is_governor: me?.role === 'governor',
    sees_whole_school: admin,
    approve_reports: admin,
    approve_requests: admin,
    manage_admissions: admin,
    manage_parents: admin,
    send_announcements: admin,
    send_alerts: admin,
    nurse: false,
    all_registers: admin,
    school_dashboard: admin,
    manage_cover: admin,
    ...(me?.permissions || {}),
  }
}

// The classes this person may work with in an area ("records", "pastoral",
// "academic" or "attendance"), filtered from `all` (the school's classes).
export function classesFor(me, all, area = 'pastoral') {
  const list = Array.isArray(all) ? all : []
  const scoped = me?.permissions?.classes
  if (scoped && area in scoped) {
    const ids = scoped[area]
    return ids === null ? list : list.filter((c) => ids.includes(c.id))
  }
  if (me?.role === 'admin') return list
  const mine = new Set((me?.assignments || []).map((a) => a.school_class))
  return list.filter((c) => mine.has(c.id))
}

export const ROLE_OPTIONS = [
  ['leadership', 'Leadership', null],
  ['head_of_year', 'Head of Year', 'year_group'],
  ['head_of_department', 'Head of Department', 'subject'],
  ['class_teacher', 'Class Teacher', 'school_class'],
  ['nurse', 'Nurse', null],
  ['admissions', 'Admissions Officer', null],
  ['secretary', 'Secretary', null],
  ['bursar', 'Bursar', null],
]

// "Head of Year (Form 2), Nurse"
export function roleSummary(roles) {
  return (roles || []).map((r) => (r.scope_name ? `${r.role_label} (${r.scope_name})` : r.role_label)).join(', ')
}

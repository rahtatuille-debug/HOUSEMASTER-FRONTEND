/** @typedef {'admin' | 'teacher'} UserRole */

/**
 * @typedef {Object} Announcement
 * @property {number} id
 * @property {number} school
 * @property {string} title
 * @property {string} body
 * @property {'all_staff' | 'all_parents' | 'year_group' | 'school_class'} audience
 * @property {number | null} year_group
 * @property {number | null} school_class
 * @property {'draft' | 'published' | 'archived'} status
 * @property {number | null} created_by
 * @property {string | null} created_by_name
 * @property {string | null} created_by_role
 * @property {string} created_at
 * @property {string | null} published_at
 * @property {string | null} archived_at
 */

/**
 * @typedef {Object} CurrentUser
 * @property {string} name
 * @property {UserRole} role
 * @property {{ id: number, name: string }} school
 */

/** @param {string | null | undefined} role */
export function getRoleLabel(role) {
  if (role === 'admin') return 'Admin'
  if (role === 'teacher') return 'Teacher'
  return 'Staff'
}

/** @param {string | null | undefined} role */
export function displayRole(role) {
  return getRoleLabel(role?.toLowerCase())
}

/** @param {{ name?: string | null, role?: string | null }} person */
export function personIdentity(person) {
  const name = person?.name?.trim()
  return name ? `${name} · ${displayRole(person.role)}` : 'School staff'
}

/** @param {{ created_by_name?: string | null, created_by_role?: string | null }} announcement */
export function announcementAuthor(announcement) {
  const name = announcement?.created_by_name?.trim()
  return name ? `${name} · ${displayRole(announcement.created_by_role)}` : 'School staff'
}

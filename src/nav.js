// How the pages are grouped. The left rail (laptop) and bottom bar (phone)
// show sections; the pages of the open section are tabs along the top of the
// page. Guide and Profile sit in the top bar instead.

export const STAFF_SECTIONS = [
  { key: 'home', label: 'Dashboard', icon: 'home', pages: ['home', 'calendar'] },
  { key: 'registers', label: 'Registers', icon: 'register', pages: ['attendance', 'timetable', 'cover', 'boarding'] },
  { key: 'reports', label: 'Reports', icon: 'reports', pages: ['grades', 'homework', 'reports', 'performance', 'exports'] },
  { key: 'messages', label: 'Messages', icon: 'messages', pages: ['messages', 'announcements', 'alerts'] },
  { key: 'students', label: 'Students', icon: 'students', pages: ['students', 'support', 'discipline', 'clubs', 'sickbay', 'admissions'] },
  // Teachers reach Setup and their requests from the profile menu and the quick links.
  { key: 'admin', label: 'Admin', icon: 'admin', pages: ['setup', 'staff', 'parents', 'approvals', 'activity'], adminOnly: true },
]

// A governor's read-only account: the school's figures, nothing else.
export const GOVERNOR_SECTIONS = [{ key: 'home', label: 'Dashboard', icon: 'home', pages: ['home'] }]
export const GOVERNOR_PAGES = ['home', 'profile']

export const GUARDIAN_SECTIONS = [
  { key: 'students', label: 'My children', icon: 'students', pages: ['students'] },
  { key: 'announcements', label: 'News', icon: 'reports', pages: ['announcements'] },
  { key: 'calendar', label: 'Calendar', icon: 'calendar', pages: ['calendar'] },
  { key: 'messages', label: 'Messages', icon: 'messages', pages: ['messages'] },
]

// The sections this person sees, each with only the pages they can open.
// Someone who isn't an admin still sees the Admin section with just the
// pages a role gives them (`granted`, e.g. Parents for the Secretary).
export function visibleSections(sections, pageKeys, isAdmin, granted = []) {
  return sections
    .map((s) => ({ ...s, pages: s.pages.filter((p) => pageKeys.includes(p) && (!s.adminOnly || isAdmin || granted.includes(p))) }))
    .filter((s) => s.pages.length > 0)
}

export function sectionOf(sections, page) {
  return sections.find((s) => s.pages.includes(page))?.key || null
}

// The phone's bottom bar has room for five buttons: the first four sections
// and "More" when there are more than five.
export function bottomBarSections(sections) {
  return sections.length <= 5 ? { bar: sections, more: [] } : { bar: sections.slice(0, 4), more: sections.slice(4) }
}

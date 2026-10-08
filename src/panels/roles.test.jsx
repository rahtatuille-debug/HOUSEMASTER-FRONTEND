// Staff roles: what the app offers each person comes from /api/me/ permissions.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'
import { classesFor, perms } from '../permissions.js'
import { STAFF_SECTIONS, visibleSections } from '../nav.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Staff } = await import('./Staff.jsx')
const { default: GovernorHome } = await import('./GovernorHome.jsx')

const classes = [{ id: 1, name: '2 East' }, { id: 2, name: '2 West' }, { id: 3, name: '3 East' }]

describe('permissions', () => {
  it('lists the classes a role covers, area by area', () => {
    const hoy = { role: 'teacher', permissions: { classes: { pastoral: [1, 2], academic: [1, 2], records: [1, 2], attendance: [1, 2] } } }
    expect(classesFor(hoy, classes, 'pastoral').map((c) => c.name)).toEqual(['2 East', '2 West'])
    const nurse = { role: 'teacher', permissions: { classes: { records: null, pastoral: [] } } }
    expect(classesFor(nurse, classes, 'records')).toHaveLength(3)
    expect(classesFor(nurse, classes, 'pastoral')).toHaveLength(0)
  })

  it('falls back to admin or own classes on an older server', () => {
    expect(classesFor({ role: 'admin' }, classes)).toHaveLength(3)
    expect(classesFor({ role: 'teacher', assignments: [{ school_class: 3 }] }, classes).map((c) => c.id)).toEqual([3])
    expect(perms({ role: 'admin' }).approve_reports).toBe(true)
    expect(perms({ role: 'teacher' }).approve_reports).toBe(false)
  })

  it('shows a role its pages inside the Admin section, and nothing else there', () => {
    const pages = ['home', 'students', 'parents', 'setup', 'approvals', 'staff']
    const secretary = visibleSections(STAFF_SECTIONS, pages, false, ['parents'])
    expect(secretary.find((s) => s.key === 'admin').pages).toEqual(['parents'])
    const teacher = visibleSections(STAFF_SECTIONS, pages, false, [])
    expect(teacher.find((s) => s.key === 'admin')).toBeUndefined()
  })
})

describe('Staff page roles', () => {
  it('an admin gives a teacher a scoped role', async () => {
    const create = vi.fn(() => Promise.resolve({}))
    mockApi.current = deepApiMock({
      'invites.list': () => Promise.resolve([]),
      'staff.list': () => Promise.resolve([{ id: 5, user_id: 50, name: 'Jane W', email: 'j@x.test', role: 'teacher', is_active: true, roles: [] }]),
      'teachingAssignments.list': () => Promise.resolve([]),
      'schoolClasses.list': () => Promise.resolve(classes),
      'subjects.list': () => Promise.resolve([]),
      'yearGroups.list': () => Promise.resolve([{ id: 9, name: 'Form 2' }]),
      'staffRoles.create': create,
    })
    render(<Staff me={{ id: 1, role: 'admin' }} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Classes and roles for Jane W' }))
    fireEvent.change(screen.getByLabelText('Role', { selector: '#role-5' }), { target: { value: 'head_of_year' } })
    fireEvent.change(screen.getByLabelText('Year group'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add role' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith({ profile: 5, role: 'head_of_year', year_group: 9 }))
    expect(await screen.findByText('Jane W is now Head of Year.')).toBeInTheDocument()
  })

  it('shows roles and removes one', async () => {
    const remove = vi.fn(() => Promise.resolve(null))
    mockApi.current = deepApiMock({
      'invites.list': () => Promise.resolve([]),
      'staff.list': () => Promise.resolve([{ id: 5, user_id: 50, name: 'Jane W', email: 'j@x.test', role: 'teacher', is_active: true,
        roles: [{ id: 7, role: 'nurse', role_label: 'Nurse', scope_name: '' }] }]),
      'teachingAssignments.list': () => Promise.resolve([]),
      'schoolClasses.list': () => Promise.resolve(classes),
      'subjects.list': () => Promise.resolve([]),
      'yearGroups.list': () => Promise.resolve([]),
      'staffRoles.remove': remove,
    })
    render(<Staff me={{ id: 1, role: 'admin' }} />)
    const row = (await screen.findByText('Jane W')).closest('tr')
    expect(within(row).getByText('Nurse')).toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', { name: 'Classes and roles for Jane W' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove Nurse from Jane W' }))
    await waitFor(() => expect(remove).toHaveBeenCalledWith(7))
  })
})

describe('Governor home', () => {
  it('shows school figures and no student names', async () => {
    mockApi.current = deepApiMock({ governorSummary: () => Promise.resolve({
      school: 'Alpha Academy', date: '2026-10-08', students: 412, staff: 31, support_open: 6, reports_waiting: 4,
      attendance: { date: '2026-10-08', is_today: true, rate: 94.5, marked: 400, students: 412, absent: 22, classes: 14, classes_not_taken: 1 },
      students_by_year_group: [{ id: 1, name: 'Form 1', female: 50, male: 52, total: 102 }],
      behaviour_last_30_days: { total: 9, minor: 6, moderate: 2, serious: 1 },
    }) })
    render(<GovernorHome me={{ name: 'Gov', role: 'governor' }} />)
    expect(await screen.findByText('Alpha Academy')).toBeInTheDocument()
    expect(screen.getByText('412')).toBeInTheDocument()
    expect(screen.getByText('94.5%')).toBeInTheDocument()
    expect(screen.getByText(/Read-only: no individual students are shown/)).toBeInTheDocument()
  })
})

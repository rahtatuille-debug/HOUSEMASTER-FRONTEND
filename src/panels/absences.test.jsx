// Parents tell the school about absences; the register shows them; staff see and mark them seen.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: ChildAbsences } = await import('./ChildAbsences.jsx')
const { default: Absences } = await import('./Absences.jsx')
const { default: Attendance } = await import('./Attendance.jsx')
const { default: GuardianStudents } = await import('./GuardianStudents.jsx')

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const today = iso(new Date())
const report = { id: 3, student: 7, student_name: 'Amina K', class_name: '2 East', start_date: today, end_date: today,
  reason: 'illness', reason_label: 'Ill', details: 'Fever since last night', reported_by_name: 'Pat Parent',
  created_at: `${today}T06:30:00Z`, cancelled_at: null, seen_by_name: '', seen_at: null }

afterEach(() => window.history.replaceState({}, '', '/'))

describe('a parent reports an absence', () => {
  it('sends the days and reason, then lists it with a way to cancel', async () => {
    let rows = []
    const reportAbsence = vi.fn((id, body) => { rows = [{ ...report, ...body }]; return Promise.resolve(rows[0]) })
    const cancelAbsence = vi.fn(() => { rows = [{ ...rows[0], cancelled_at: `${today}T08:00:00Z` }]; return Promise.resolve(rows[0]) })
    mockApi.current = deepApiMock({
      'guardianStudents.absences': () => Promise.resolve(rows), 'guardianStudents.reportAbsence': reportAbsence,
      'guardianStudents.cancelAbsence': cancelAbsence,
    })
    render(<ChildAbsences studentId={7} firstName="Amina" />)
    expect(await screen.findByText('None reported.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Report an absence' }))
    const form = within(screen.getByRole('form', { name: 'Report an absence' }))
    fireEvent.change(form.getByLabelText('Reason'), { target: { value: 'appointment' } })
    fireEvent.change(form.getByLabelText(/Anything the school should know/), { target: { value: 'Dentist at 10' } })
    fireEvent.click(form.getByRole('button', { name: 'Tell the school' }))
    await waitFor(() => expect(reportAbsence).toHaveBeenCalledWith(7, { start_date: today, end_date: today, reason: 'appointment', details: 'Dentist at 10' }))
    expect(await screen.findByText(/The school has been told/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Cancel the absence on/ }))
    await waitFor(() => expect(cancelAbsence).toHaveBeenCalledWith(7, 3))
    expect(await screen.findByText('Cancelled')).toBeInTheDocument()
  })

  it('a student sees what was reported but cannot report', async () => {
    mockApi.current = deepApiMock({ 'guardianStudents.absences': () => Promise.resolve([report]) })
    render(<ChildAbsences studentId={7} firstName="Amina" readOnly />)
    expect(await screen.findByText(/Reported by Pat Parent/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Report an absence' })).toBeNull()
    expect(screen.queryByRole('button', { name: /Cancel/ })).toBeNull()
  })

  it("the alert email's link opens the child's attendance with the form for that day", async () => {
    window.history.replaceState({}, '', `/?absence=7&date=${today}`)
    mockApi.current = deepApiMock({
      'guardianStudents.list': () => Promise.resolve([{ id: 7, first_name: 'Amina', last_name: 'K' }]),
      'guardianStudents.profile': () => Promise.resolve({ student: { id: 7, first_name: 'Amina', last_name: 'K' }, teachers: [],
        attendance: { overall: { rate: 90, present: 9, absent: 1, late: 0, excused: 0 }, recent: [] }, performance: [] }),
      'guardianStudents.grades': () => Promise.resolve([]), 'guardianStudents.reports': () => Promise.resolve([]),
      'guardianStudents.absences': () => Promise.resolve([]),
    })
    render(<GuardianStudents />)
    const form = await screen.findByRole('form', { name: 'Report an absence' })
    expect(within(form).getByLabelText('First day')).toHaveValue(today)
    expect(screen.getByRole('tab', { name: 'Attendance' })).toHaveAttribute('aria-selected', 'true')
    expect(window.location.search).toBe('')
  })
})

describe('the register', () => {
  it("starts a child a parent reported as excused, with the parent's reason", async () => {
    mockApi.current = deepApiMock({
      'schoolClasses.list': () => Promise.resolve([{ id: 5, name: '2 East' }]),
      'students.list': () => Promise.resolve([{ id: 7, first_name: 'Amina', last_name: 'K' }, { id: 8, first_name: 'Ben', last_name: 'O' }]),
      'attendance.list': () => Promise.resolve([]),
      'absenceReports.list': () => Promise.resolve([report]),
    })
    render(<Attendance me={{ id: 9, role: 'admin', assignments: [] }} />)
    expect(await screen.findByText('Parent: Ill')).toBeInTheDocument()
    expect(screen.getByText(/Fever since last night/)).toBeInTheDocument()
    const amina = within(screen.getByRole('group', { name: 'Status for Amina K' }))
    expect(amina.getByRole('button', { name: 'Excused' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Note for Amina K')).toHaveValue('Parent: Ill')
    const ben = within(screen.getByRole('group', { name: 'Status for Ben O' }))
    expect(ben.getByRole('button', { name: 'Present' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('the Absences page', () => {
  it('lists reports, marks them seen, and lets an admin turn alerts off', async () => {
    const seen = vi.fn(() => Promise.resolve({ ...report, seen_at: `${today}T07:00:00Z`, seen_by_name: 'Ms Achieng' }))
    const setAlerts = vi.fn((on) => Promise.resolve({ alerts_enabled: on }))
    mockApi.current = deepApiMock({
      'absenceReports.list': () => Promise.resolve([report]), 'absenceReports.seen': seen,
      'absenceReports.settings': () => Promise.resolve({ alerts_enabled: true }), 'absenceReports.setAlerts': setAlerts,
    })
    render(<Absences me={{ role: 'admin' }} />)
    expect(await screen.findByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Fever since last night')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Mark Amina K's absence as seen" }))
    expect(await screen.findByText(/Seen by Ms Achieng/)).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: 'Turn off' }))
    await waitFor(() => expect(setAlerts).toHaveBeenCalledWith(false))
    expect(await screen.findByText(/Off: parents are not told/)).toBeInTheDocument()
  })

  it('a teacher sees the setting but cannot change it', async () => {
    mockApi.current = deepApiMock({
      'absenceReports.list': () => Promise.resolve([]), 'absenceReports.settings': () => Promise.resolve({ alerts_enabled: true }),
    })
    render(<Absences me={{ role: 'teacher' }} />)
    expect(await screen.findByText(/On: when a student is marked absent/)).toBeInTheDocument()
    expect(screen.getByText('No absences reported by parents.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Turn off' })).toBeNull()
  })
})

// Clubs and activities: the list, a club's members, register and fixtures,
// and what parents see.
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Clubs, resultText } = await import('./Clubs.jsx')
const { ChildClubs } = await import('./GuardianStudents.jsx')

const football = { id: 1, name: 'Football', kind: 'sport', kind_label: 'Sport', meets: 'Tuesdays 3:30pm', location: 'Main field',
  description: '', leaders: ['Mr Coach'], leader_ids: [4], is_active: true, member_count: 2, can_manage: true }
const chess = { ...football, id: 2, name: 'Chess', kind_label: 'Club or society', can_manage: false, member_count: 5 }
const members = [
  { student: 7, name: 'Amina K', class_name: '2 East', role: 'Captain', attendance: { present: 3, absent: 1, excused: 0, sessions: 4 } },
  { student: 8, name: 'Ben O', class_name: '2 West', role: '', attendance: { present: 0, absent: 0, excused: 0, sessions: 0 } },
]
const fixture = { id: 9, club: 1, club_name: 'Football', date: '2099-01-10', start_time: '14:00:00', opponent: "St Mary's",
  venue: 'away', venue_label: 'Away', location: '', competition: 'League', team: 'U15', our_score: null, their_score: null,
  result_note: '', outcome: null, report: '', players: [{ id: 7, name: 'Amina K' }], can_manage: true }

function setup(overrides = {}, me = { role: 'teacher', permissions: { is_leader: false } }) {
  mockApi.current = deepApiMock({
    'clubs.list': () => Promise.resolve([football, chess]),
    'fixtures.list': (p) => Promise.resolve(p?.results ? [{ ...fixture, id: 10, date: '2026-09-01', our_score: 3, their_score: 1, outcome: 'win' }] : [fixture]),
    'clubs.members': () => Promise.resolve(members),
    'clubs.register': () => Promise.resolve({ date: '2026-10-08', taken: false, note: '', students: members.map((m) => ({ ...m, status: null })) }),
    'clubs.sessions': () => Promise.resolve([]),
    'clubs.staff': () => Promise.resolve([{ id: 4, name: 'Mr Coach' }, { id: 5, name: 'Ms Wanjiru' }]),
    ...overrides,
  })
  render(<Clubs me={me} />)
}

describe('Clubs list', () => {
  it('shows every club, what is coming up and the latest results', async () => {
    setup()
    expect(await screen.findByRole('button', { name: /Football/ })).toHaveTextContent('Sport · You run this')
    expect(screen.getByRole('button', { name: /Chess/ })).toHaveTextContent('5 members')
    expect(screen.getAllByText("Football (U15) v St Mary's").length).toBe(2)
    expect(screen.getByText('Won 3–1')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add a club' })).toBeNull() // teachers don't add clubs
    fireEvent.click(screen.getByRole('tab', { name: 'Clubs I run' }))
    expect(screen.queryByRole('button', { name: /Chess/ })).toBeNull()
  })

  it('leadership adds a club and chooses its staff', async () => {
    const create = vi.fn(() => Promise.resolve({ ...football, id: 3, name: 'Netball' }))
    setup({ 'clubs.create': create }, { role: 'teacher', permissions: { is_leader: true } })
    fireEvent.click(await screen.findByRole('button', { name: 'Add a club' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Netball' } })
    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'sport' } })
    fireEvent.click(await screen.findByLabelText('Ms Wanjiru'))
    fireEvent.click(screen.getByRole('button', { name: 'Add club' }))
    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Netball', kind: 'sport', leaders: [5] })))
    expect(await screen.findByText('Netball was added.')).toBeInTheDocument()
  })
})

describe('A club', () => {
  it('lists members with attendance, and the coach adds a student found by name', async () => {
    const add = vi.fn(() => Promise.resolve({ added: 1, already: 0 }))
    setup({ 'clubs.candidates': () => Promise.resolve([{ student: 11, name: 'Cate M', class_name: '3 East' }]), 'clubs.addMembers': add })
    fireEvent.click(await screen.findByRole('button', { name: /Football/ }))
    const table = await screen.findByRole('table')
    expect(within(table).getAllByRole('row')[1]).toHaveTextContent('Amina K2 EastCaptain3 of 4')
    fireEvent.change(screen.getByLabelText('Add a student'), { target: { value: 'cat' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Add Cate M' }))
    await waitFor(() => expect(add).toHaveBeenCalledWith(1, { students: [11] }))
    expect(await screen.findByText('Cate M joined Football.')).toBeInTheDocument()
  })

  it('takes a register', async () => {
    const save = vi.fn(() => Promise.resolve({}))
    setup({ 'clubs.saveRegister': save })
    fireEvent.click(await screen.findByRole('button', { name: /Football/ }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Register' }))
    const ben = await screen.findByRole('radiogroup', { name: 'Attendance for Ben O' })
    fireEvent.click(within(ben).getByRole('radio', { name: 'Absent' }))
    fireEvent.click(screen.getByRole('button', { name: 'Everyone else present' }))
    fireEvent.click(screen.getByRole('button', { name: /Save register \(2 of 2 marked\)/ }))
    await waitFor(() => expect(save).toHaveBeenCalledWith(1, expect.objectContaining({
      marks: [{ student: 7, status: 'present' }, { student: 8, status: 'absent' }] })))
  })

  it('records a result and picks a squad', async () => {
    const update = vi.fn((id, body) => Promise.resolve(body.players ? { parents_emailed: 1 } : {}))
    setup({ 'fixtures.update': update })
    fireEvent.click(await screen.findByRole('button', { name: /Football/ }))
    fireEvent.click(await screen.findByRole('tab', { name: 'Fixtures and results' }))
    fireEvent.click(await screen.findByRole('button', { name: "Result v St Mary's" }))
    fireEvent.change(screen.getByLabelText('Our score'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Their score'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save result' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(9, expect.objectContaining({ our_score: 2, their_score: 2 })))
    fireEvent.click(await screen.findByRole('button', { name: "Squad v St Mary's" }))
    fireEvent.click(screen.getByLabelText('Ben O'))
    fireEvent.click(screen.getByRole('button', { name: 'Save squad' }))
    await waitFor(() => expect(update).toHaveBeenLastCalledWith(9, { players: [7, 8] }))
    expect(await screen.findByText('Squad saved. 1 parent has been emailed that their child was picked.')).toBeInTheDocument()
  })

  it('other teachers see the club without the register or management buttons', async () => {
    setup()
    fireEvent.click(await screen.findByRole('button', { name: /Chess/ }))
    await screen.findByRole('table')
    expect(screen.queryByRole('tab', { name: 'Register' })).toBeNull()
    expect(screen.queryByLabelText('Add a student')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit club' })).toBeNull()
  })
})

describe('Parents', () => {
  it("see their child's clubs, attendance, squads and results", () => {
    render(<ChildClubs firstName="Amina" clubs={[{ id: 1, name: 'Football', kind_label: 'Sport', meets: 'Tuesdays', location: '',
      leaders: ['Mr Coach'], role: 'Captain', attendance: { present: 5, absent: 1, excused: 0, sessions: 6 },
      upcoming: [{ ...fixture, selected: true }],
      results: [{ ...fixture, id: 10, our_score: 1, their_score: 2, outcome: 'loss', selected: true, report: 'Unlucky.' }] }]} />)
    expect(screen.getByText('5 of 6')).toBeInTheDocument()
    expect(screen.getByText('Amina is in the squad')).toBeInTheDocument()
    expect(screen.getByText('Lost 1–2')).toBeInTheDocument()
    expect(screen.getByText('Unlucky.')).toBeInTheDocument()
  })

  it('a plain line when there are none', () => {
    render(<ChildClubs firstName="Amina" clubs={[]} />)
    expect(screen.getByText("Amina isn't in any school clubs or teams yet.")).toBeInTheDocument()
  })

  it('result text', () => {
    expect(resultText({ outcome: 'draw', our_score: 0, their_score: 0, result_note: 'Won on penalties' })).toBe('Drew 0–0 · Won on penalties')
    expect(resultText({ outcome: null, result_note: '3rd of 12' })).toBe('3rd of 12')
  })
})

describe('Teacher home', () => {
  it('shows the clubs I run with fixtures coming up', async () => {
    const { default: TeacherHome } = await import('./TeacherHome.jsx')
    const navigate = vi.fn()
    mockApi.current = deepApiMock({
      'teacherHome.get': () => Promise.resolve({ classes: [], checklist: { items: [], hidden: true }, today: null, support: null, boarding: null,
        clubs: [{ id: 1, name: 'Football', meets: 'Tuesdays', member_count: 23, fixtures: [fixture] }] }),
    })
    render(<TeacherHome me={{ role: 'teacher', name: 'Mr Coach' }} onNavigate={navigate} />)
    const panel = await screen.findByRole('region', { name: 'My clubs' })
    expect(within(panel).getByText('Football')).toBeInTheDocument()
    expect(within(panel).getByText("v St Mary's")).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button', { name: 'More for My clubs' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Open Clubs' }))
    expect(navigate).toHaveBeenCalledWith('clubs')
  })
})

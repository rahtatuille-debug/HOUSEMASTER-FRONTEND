// Admissions: families apply through the public form; admins share the link,
// move applications on and enrol.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: Apply } = await import('./Apply.jsx')
const { default: Admissions } = await import('./Admissions.jsx')

afterEach(() => vi.restoreAllMocks())

const info = {
  school: { name: 'Alpha Academy', email: 'office@alpha.test', phone: '', country: { code: 'ke', phone_example: '+254 712 345 678' },
    privacy_contact: '', has_boarding: false },
  intro: 'Welcome to Alpha.', year_groups: [{ id: 3, name: 'Year 7' }],
}
const app = {
  id: 9, reference: 'A26-0009', status: 'new', status_label: 'New', year_group: 3, year_group_name: 'Year 7', start: '',
  first_name: 'Zara', last_name: 'Patel', date_of_birth: '2015-03-02', gender: 'female', current_school: 'Hill Primary',
  mode_of_learning: 'day', medical_notes: '', notes: '', parent_name: 'Priya Patel', parent_email: 'priya@example.test',
  parent_phone: '+254 700 000 001', relationship: 'mother', staff_notes: '', interview_at: null, decision_note: '',
  created_at: '2026-10-01T09:00:00Z', student: null, student_class: '',
}

describe('Public application form', () => {
  it('B-1: sends an application and asks the family to confirm their email', async () => {
    const submit = vi.fn(() => Promise.resolve({ detail: 'Thank you. Check your email and confirm your address to send the application.' }))
    mockApi.current = deepApiMock({ applyInfo: () => Promise.resolve(info), submitApplication: submit })
    render(<Apply token="tok" onSignIn={() => {}} />)
    expect(await screen.findByText('Welcome to Alpha.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Day or boarding')).toBeNull()  // no boarding at this school
    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Zara' } })
    fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Patel' } })
    fireEvent.change(screen.getByLabelText('Date of birth'), { target: { value: '2015-03-02' } })
    fireEvent.change(screen.getByLabelText('Applying for'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Your full name'), { target: { value: 'Priya Patel' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'priya@example.test' } })
    fireEvent.change(screen.getByLabelText('Phone'), { target: { value: '+254 700 000 001' } })
    expect(screen.getByRole('button', { name: 'Send application' })).toBeDisabled()  // privacy not accepted
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Send application' }))
    expect(await screen.findByText(/Check your email/)).toBeInTheDocument()
    expect(screen.getByText(/priya@example.test/)).toBeInTheDocument()
    expect(screen.queryByText(/reference/)).toBeNull()
    expect(submit).toHaveBeenCalledWith('tok', expect.objectContaining({ first_name: 'Zara', year_group: 3, consent: true, website: '' }))
  })

  it('B-2: sends once, however fast it is submitted again', async () => {
    let finish
    const submit = vi.fn(() => new Promise((resolve) => { finish = resolve }))
    mockApi.current = deepApiMock({ applyInfo: () => Promise.resolve(info), submitApplication: submit })
    const { container } = render(<Apply token="tok" onSignIn={() => {}} />)
    await screen.findByText('Welcome to Alpha.')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'priya@example.test' } })
    fireEvent.click(screen.getByRole('checkbox'))
    const form = container.querySelector('form')
    fireEvent.submit(form)
    fireEvent.submit(form)  // a double click, or Enter pressed twice
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDisabled()
    finish({ detail: 'ok' })
    expect(await screen.findByText(/Check your email/)).toBeInTheDocument()
    expect(submit).toHaveBeenCalledTimes(1)
  })

  it('B-5: the phone field says which formats work', async () => {
    mockApi.current = deepApiMock({ applyInfo: () => Promise.resolve(info) })
    render(<Apply token="tok" onSignIn={() => {}} />)
    expect(await screen.findByText(/0712 345 678 or \+254 712 345 678/)).toBeInTheDocument()
  })

  it('asks a yes/no question about needs, not for health details', async () => {
    const submit = vi.fn(() => Promise.resolve({ detail: 'ok' }))
    mockApi.current = deepApiMock({ applyInfo: () => Promise.resolve(info), submitApplication: submit })
    const { container } = render(<Apply token="tok" onSignIn={() => {}} />)
    await screen.findByText('Welcome to Alpha.')
    expect(container.querySelector('textarea#ap-medical')).toBeNull()
    fireEvent.change(screen.getByLabelText(/health or learning needs we should discuss/), { target: { value: 'yes' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'priya@example.test' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.submit(container.querySelector('form'))
    await waitFor(() => expect(submit).toHaveBeenCalledWith('tok', expect.objectContaining({ has_needs: true })))
    expect(submit.mock.calls[0][1]).not.toHaveProperty('medical_notes')
  })

  it('says when the form is closed', async () => {
    mockApi.current = deepApiMock({ applyInfo: () => Promise.reject(new Error("This application form isn't open.")) })
    render(<Apply token="tok" onSignIn={() => {}} />)
    expect(await screen.findByText("This application form isn't open.")).toBeInTheDocument()
  })
})

describe('B-1: confirming the email', () => {
  it('confirms with the link and shows the reference', async () => {
    const { default: ConfirmApplication } = await import('./ConfirmApplication.jsx')
    const confirm = vi.fn(() => Promise.resolve({ reference: 'A26-0010', school: 'Alpha Academy' }))
    mockApi.current = deepApiMock({ confirmApplication: confirm })
    render(<ConfirmApplication token="tok123" onDone={() => {}} />)
    expect(await screen.findByText(/sent to Alpha Academy/)).toBeInTheDocument()
    expect(screen.getByText(/A26-0010/)).toBeInTheDocument()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm).toHaveBeenCalledWith('tok123')
  })

  it('says when the link has expired or was used', async () => {
    const { default: ConfirmApplication } = await import('./ConfirmApplication.jsx')
    mockApi.current = deepApiMock({ confirmApplication: () => Promise.reject(new Error('This link has expired or has already been used.')) })
    render(<ConfirmApplication token="old" onDone={() => {}} />)
    expect(await screen.findByText(/expired or has already been used/)).toBeInTheDocument()
  })
})

describe('Admissions page', () => {
  function adminApi(overrides = {}) {
    return deepApiMock({
      'admissions.settings': () => Promise.resolve({ is_open: true, intro: 'Hi', year_groups: [], link_token: 'abc' }),
      'admissions.list': vi.fn(() => Promise.resolve([app])),
      'admissions.summary': () => Promise.resolve({ counts: { new: 1 } }),
      'yearGroups.list': () => Promise.resolve([{ id: 3, name: 'Year 7' }]),
      'schoolClasses.list': () => Promise.resolve([{ id: 21, name: '7A', year_group: 3 }]),
      ...overrides,
    })
  }

  it('shows the link to share and the applications in progress', async () => {
    mockApi.current = adminApi()
    render(<Admissions />)
    expect(await screen.findByText(`${window.location.origin}/apply/abc`)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Zara Patel' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'In progress (1)' })).toBeInTheDocument()
    expect(mockApi.current.admissions.list).toHaveBeenCalledWith({ status: 'new,reviewing,interview,offered,accepted,waitlist' })
  })

  it('offers a place and emails the family', async () => {
    const update = vi.fn(() => Promise.resolve({}))
    mockApi.current = adminApi({ 'admissions.update': update })
    render(<Admissions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'offered' } })
    fireEvent.change(screen.getByLabelText(/Note for the family/), { target: { value: 'Welcome aboard!' } })
    expect(screen.getByLabelText('Email the family')).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(9, expect.objectContaining({ status: 'offered', decision_note: 'Welcome aboard!', tell_family: true })))
    expect(await screen.findByText(/The family has been emailed \(offered a place\)/)).toBeInTheDocument()
  })

  it('enrols an offered applicant in a class of their year group', async () => {
    const enrol = vi.fn(() => Promise.resolve({ message: 'Zara Patel is enrolled in 7A. Invited Priya Patel to set up a parent account.' }))
    mockApi.current = adminApi({ 'admissions.list': vi.fn(() => Promise.resolve([{ ...app, status: 'offered', status_label: 'Offered a place' }])),
      'admissions.enrol': enrol })
    render(<Admissions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enrol' }))
    await waitFor(() => expect(enrol).toHaveBeenCalledWith(9, 21, undefined))
    expect(await screen.findByText(/is enrolled in 7A/)).toBeInTheDocument()
  })

  it('B-1: lists applications still waiting for the family to confirm, separately', async () => {
    const list = vi.fn((params) => Promise.resolve(params?.unconfirmed ? [{ ...app, id: 12, first_name: 'Omar' }] : [app]))
    mockApi.current = adminApi({ 'admissions.list': list,
      'admissions.summary': () => Promise.resolve({ counts: { new: 1 }, unconfirmed: 1 }) })
    render(<Admissions />)
    await screen.findByRole('button', { name: 'Zara Patel' })
    expect(screen.queryByRole('button', { name: 'Omar Patel' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Email not confirmed (1)' }))
    expect(await screen.findByText('Omar Patel')).toBeInTheDocument()
    expect(list).toHaveBeenLastCalledWith({ unconfirmed: 1 })
    expect(screen.getByText(/has to apply again/)).toBeInTheDocument()
  })

  it('B-2: refusing to enrol a child who is already a student says who', async () => {
    const err = Object.assign(new Error('Bad request'), { data: { detail: 'Zara Patel, born 02 Mar 2015, is already a student here. Open their student page instead of enrolling them again.', existing_student: 41 } })
    mockApi.current = adminApi({ 'admissions.list': vi.fn(() => Promise.resolve([{ ...app, status: 'offered', status_label: 'Offered a place' }])),
      'admissions.enrol': () => Promise.reject(err) })
    render(<Admissions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enrol' }))
    expect(await screen.findByText(/is already a student here/)).toBeInTheDocument()
  })

  it('B-4: sets how long closed applications are kept (off by default)', async () => {
    const save = vi.fn((body) => Promise.resolve({ is_open: true, intro: 'Hi', year_groups: [], link_token: 'abc', retention_days: body.retention_days }))
    mockApi.current = adminApi({ 'admissions.saveSettings': save })
    render(<Admissions />)
    const field = await screen.findByLabelText(/Delete closed applications after/)
    expect(field).toHaveValue(null)
    expect(screen.getByText(/Empty: kept until you delete them/)).toBeInTheDocument()
    fireEvent.change(field, { target: { value: '365' } })
    fireEvent.blur(field)
    await waitFor(() => expect(save).toHaveBeenCalledWith({ retention_days: 365 }))
    fireEvent.change(field, { target: { value: '' } })
    fireEvent.blur(field)
    await waitFor(() => expect(save).toHaveBeenLastCalledWith({ retention_days: null }))
  })

  it('B-5: flags an age far from the year group without blocking anything', async () => {
    mockApi.current = adminApi({ 'admissions.list': vi.fn(() => Promise.resolve([{ ...app, status: 'offered', status_label: 'Offered a place',
      age_note: 'Zara is 5; most students in Year 7 are 11. Check the year group.' }])) })
    render(<Admissions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    expect(screen.getByText(/most students in Year 7 are 11/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '21' } })
    expect(screen.getByRole('button', { name: 'Enrol' })).toBeEnabled()
  })

  it('B-5: sets the admission number prefix and the next number, and shows a new student\'s number', async () => {
    const save = vi.fn((body) => Promise.resolve({ is_open: true, intro: 'Hi', year_groups: [], link_token: 'abc', number_prefix: 'ADM/', next_number: 1, ...body }))
    mockApi.current = adminApi({ 'admissions.saveSettings': save,
      'admissions.settings': () => Promise.resolve({ is_open: true, intro: 'Hi', year_groups: [], link_token: 'abc', number_prefix: '', next_number: 1 }),
      'admissions.list': vi.fn(() => Promise.resolve([{ ...app, status: 'enrolled', status_label: 'Enrolled', student: 5, student_class: '7A', student_number: 'ADM/41' }])) })
    render(<Admissions />)
    const prefix = await screen.findByLabelText('Admission number prefix')
    fireEvent.change(prefix, { target: { value: 'ADM/' } })
    fireEvent.blur(prefix)
    await waitFor(() => expect(save).toHaveBeenCalledWith({ number_prefix: 'ADM/' }))
    const next = screen.getByLabelText('Next admission number')
    fireEvent.change(next, { target: { value: '41' } })
    fireEvent.blur(next)
    await waitFor(() => expect(save).toHaveBeenLastCalledWith({ next_number: 41 }))
    fireEvent.click(screen.getByRole('tab', { name: /Closed/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    expect(screen.getByText('ADM/41')).toBeInTheDocument()
  })

  it('offers "Enrol anyway" when the child matches an existing student, and sends it', async () => {
    const err = Object.assign(new Error('Bad request'), { data: { detail: 'Zara Patel, born 02 Mar 2015, is already a student here.', existing_student: 41 } })
    const enrol = vi.fn((id, cls, opts) => (opts?.differentChild ? Promise.resolve({ message: 'Zara Patel is enrolled in 7A.' }) : Promise.reject(err)))
    mockApi.current = adminApi({ 'admissions.list': vi.fn(() => Promise.resolve([{ ...app, status: 'offered', status_label: 'Offered a place' }])),
      'admissions.enrol': enrol })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<Admissions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    fireEvent.change(screen.getByLabelText('Class'), { target: { value: '21' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enrol' }))
    fireEvent.click(await screen.findByRole('button', { name: /different child: enrol anyway/i }))
    await waitFor(() => expect(enrol).toHaveBeenLastCalledWith(9, 21, { differentChild: true }))
    expect(await screen.findByText(/is enrolled in 7A/)).toBeInTheDocument()
  })

  it('shows the family\'s yes/no answer about needs', async () => {
    mockApi.current = adminApi({ 'admissions.list': vi.fn(() => Promise.resolve([{ ...app, has_needs: true }])) })
    render(<Admissions />)
    fireEvent.click(await screen.findByRole('button', { name: 'Zara Patel' }))
    expect(screen.getByText(/Yes: ask the family after an offer/)).toBeInTheDocument()
  })
})

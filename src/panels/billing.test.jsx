// The school's subscription: the admin's Billing page, the banner, and what a locked school sees.
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

const { default: Billing, billingSentence } = await import('./Billing.jsx')
const { default: App } = await import('../App.jsx')

const tiers = [
  { name: 'Small', max_students: 300, monthly_price: '5000.00', currency: 'KES' },
  { name: 'Medium', max_students: 1000, monthly_price: '12000.00', currency: 'KES' },
  { name: 'Large', max_students: null, monthly_price: null, currency: 'KES' },
]
// The owner's price: KES 50 a month for each active student.
const perStudent = { name: 'Per student', max_students: null, monthly_price: null, price_per_student: '50.00', currency: 'KES' }
const invoice = { id: 4, number: 'HM-202610-0007-1', plan_name: 'Per student', students: 240, amount: '12000.00', currency: 'KES',
  period_start: '2026-10-01', period_end: '2026-10-31', issued_on: '2026-10-01', due_on: '2026-10-01', status: 'open',
  status_label: 'Open', paid_on: null, payment_method: '', payment_reference: '', school_reported_at: null }
const billing = {
  status: 'overdue', label: 'Payment overdue', locked_from: '2026-10-15', days_left: 7, invoice: 4, exempt: false, grace_days: 14,
  students: 240, paid_until: null, plan: { ...perStudent, monthly_amount: '12000.00' }, tiers: [perStudent], payment_instructions: 'M-Pesa Paybill 123456\nAccount: your invoice number',
  invoices: [invoice, { ...invoice, id: 3, number: 'HM-202609-0007-1', status: 'paid', status_label: 'Paid', paid_on: '2026-09-03' }],
}

function forbidden(code) {
  return () => {
    const err = new Error('Forbidden')
    err.status = 403
    if (code) err.data = { detail: 'HouseMaster is paused for your school. Please contact your school\'s administrator.', code }
    return Promise.reject(err)
  }
}

describe('Billing page', () => {
  it('shows the status, the price per student, how to pay and the invoices', async () => {
    mockApi.current = deepApiMock({ 'billing.get': () => Promise.resolve(billing) })
    render(<Billing />)
    expect(await screen.findByText('Payment overdue')).toBeInTheDocument()
    expect(screen.getByText(/pause for everyone at your school/)).toBeInTheDocument()
    expect(screen.getByText('KES 50 per student a month')).toBeInTheDocument()
    expect(screen.getAllByText('KES 12,000')).toHaveLength(3) // a month for the school, and each invoice
    expect(screen.queryByText('Prices')).toBeNull() // one price: no table
    expect(screen.getByText(/M-Pesa Paybill 123456/)).toBeInTheDocument()
    expect(screen.getByText('HM-202610-0007-1')).toBeInTheDocument()
    // Only the open invoice can be reported as paid.
    expect(screen.getAllByRole('button', { name: "We've paid" })).toHaveLength(1)
  })

  it('size tiers, if the owner switches them back on', async () => {
    mockApi.current = deepApiMock({ 'billing.get': () => Promise.resolve({ ...billing, plan: { ...tiers[0], monthly_amount: '5000.00' }, tiers }) })
    render(<Billing />)
    expect(await screen.findByText('KES 5,000 a month')).toBeInTheDocument()
    expect(screen.getByText('301–1000 students')).toBeInTheDocument()
    expect(screen.getByText('1001+ students')).toBeInTheDocument()
    expect(screen.getByText('Price not set')).toBeInTheDocument()
  })

  it("tells HouseMaster it's paid, then shows it's being checked", async () => {
    let reported = false
    const reportPaid = vi.fn(() => { reported = true; return Promise.resolve({}) })
    mockApi.current = deepApiMock({
      'billing.get': () => Promise.resolve(reported
        ? { ...billing, invoices: [{ ...invoice, school_reported_at: '2026-10-08T09:00:00Z' }] } : billing),
      'billing.reportPaid': reportPaid,
    })
    render(<Billing />)
    fireEvent.click(await screen.findByRole('button', { name: "We've paid" }))
    const form = within(screen.getByRole('form', { name: "We've paid HM-202610-0007-1" }))
    fireEvent.change(form.getByLabelText('Reference'), { target: { value: 'QJK12AB34' } })
    fireEvent.click(form.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(reportPaid).toHaveBeenCalledWith(4, { method: 'mpesa', reference: 'QJK12AB34', note: '' }))
    expect(await screen.findByText(/We're checking/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: "We've paid" })).toBeNull()
  })

  it('downloads an invoice PDF', async () => {
    const invoicePdf = vi.fn(() => Promise.resolve())
    mockApi.current = deepApiMock({ 'billing.get': () => Promise.resolve(billing), 'billing.invoicePdf': invoicePdf })
    render(<Billing />)
    fireEvent.click(await screen.findByRole('button', { name: 'Download HM-202609-0007-1' }))
    expect(invoicePdf).toHaveBeenCalledWith(3)
  })

  it('an exempt school sees it is free, with no prices', async () => {
    mockApi.current = deepApiMock({ 'billing.get': () => Promise.resolve({ ...billing, status: 'exempt', label: 'Free', exempt: true, invoices: [] }) })
    render(<Billing />)
    expect(await screen.findByText(/free of charge/)).toBeInTheDocument()
    expect(screen.queryByText('Prices')).toBeNull()
    expect(screen.getByText('No invoices yet.')).toBeInTheDocument()
  })

  it('says how long is left', () => {
    expect(billingSentence({ status: 'due', days_left: 1 })).toBe('An invoice is due in 1 day.')
    expect(billingSentence({ status: 'due', days_left: 0 })).toBe('An invoice is due today.')
    expect(billingSentence({ status: 'active' })).toBe('Your subscription is paid up.')
  })
})

const school = { id: 1, name: 'Alpha Academy', setup_completed: true, education_system: 'cbc' }

describe('Billing in the app', () => {
  it('a locked school: other staff see the paused screen, not the sign-in page', async () => {
    const guardianMe = vi.fn(forbidden('school_locked'))
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden('school_locked'), guardianMe })
    render(<App />)
    expect(await screen.findByText('HouseMaster is paused for your school')).toBeInTheDocument()
    expect(screen.getByText(/contact your school's administrator/)).toBeInTheDocument()
    expect(guardianMe).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /sign in/i })).toBeNull()
  })

  it('a locked school: a parent sees the paused screen too', async () => {
    mockApi.current = deepApiMock({ isLoggedIn: () => true, me: forbidden(), guardianMe: forbidden('school_locked') })
    render(<App />)
    expect(await screen.findByText('HouseMaster is paused for your school')).toBeInTheDocument()
  })

  it("a locked school's admin sees only Billing and their profile", async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [],
        billing: { status: 'locked', label: 'Locked: payment overdue', locked_from: '2026-10-01', days_left: 0 } }),
      'billing.get': () => Promise.resolve({ ...billing, status: 'locked', label: 'Locked: payment overdue', days_left: 0 }),
    })
    const { container } = render(<App />)
    expect(await screen.findByText('Locked: payment overdue')).toBeInTheDocument()
    expect([...container.querySelectorAll('.rail [data-section]')].map((b) => b.dataset.section)).toEqual(['admin'])
    expect(container.querySelector('.billing-banner')).toHaveTextContent('HouseMaster is paused for your school')
  })

  it('an admin with an overdue invoice gets a banner that opens Billing', async () => {
    mockApi.current = deepApiMock({
      isLoggedIn: () => true,
      me: () => Promise.resolve({ id: 1, name: 'Amina', role: 'admin', tour_seen: true, school, assignments: [],
        billing: { status: 'overdue', label: 'Payment overdue', locked_from: '2026-10-15', days_left: 7 } }),
      dashboard: () => Promise.resolve({ attendance_today: { students: 0, marked: 0, absent: 0, rate: 0, classes_not_taken: [], classes: [] },
        reports_waiting: { count: 0, items: [] }, requests_waiting: 0, parent_signups_waiting: 0,
        invites: { pending: 0, expired: 0, items: [] }, students_without_parent: { count: 0, total_students: 0, items: [] }, active_alerts: [] }),
      'checklist.get': () => Promise.resolve({ system: 'cbc', hidden: false, steps: [], done: 0, total: 0 }),
      'billing.get': () => Promise.resolve(billing),
    })
    render(<App />)
    const banner = await screen.findByRole('alert')
    expect(banner).toHaveTextContent('An invoice is overdue')
    fireEvent.click(within(banner).getByRole('button', { name: 'Open billing' }))
    expect(await screen.findByRole('tab', { name: 'Billing' })).toHaveAttribute('aria-selected', 'true')
  })
})

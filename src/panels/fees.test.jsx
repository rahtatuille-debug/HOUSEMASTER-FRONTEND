// School fees: the bursar's balances, statement, fee structure and claims; a parent's Fees tab.
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

const { default: Fees } = await import('./Fees.jsx')
const { default: ChildFees } = await import('./ChildFees.jsx')

afterEach(() => vi.restoreAllMocks())

const balances = {
  currency: 'KES', open_claims: 1,
  totals: { charged: '66000', paid: '48000', balance: '18000', owing: 1 },
  students: [
    { student: 7, name: 'Amina K', external_id: 'ADM-7', class_name: '1 East', charged: '33000', paid: '15000', balance: '18000' },
    { student: 8, name: 'Ben O', external_id: '', class_name: '2 East', charged: '33000', paid: '33000', balance: '0' },
  ],
}
const statement = (extra = {}) => ({
  student: 7, student_name: 'Amina K', currency: 'KES', charged: '33000', paid: '15000', balance: '18000',
  charges: [{ id: 1, kind: 'fee', kind_label: 'Fee', description: 'Tuition', amount: '18000', term: 'Term 3 2026', from_fee_item: true },
    { id: 2, kind: 'fee', kind_label: 'Fee', description: 'Boarding', amount: '15000', term: 'Term 3 2026', from_fee_item: true }],
  payments: [{ id: 5, amount: '15000', paid_on: '2026-09-20', method: 'mpesa', method_label: 'M-Pesa', reference: 'QWE123', receipt_number: 'R2026-00001', voided: false }],
  claims: [], ...extra,
})

describe('the bursar', () => {
  it('sees balances and who owes, and opens a statement to record a payment', async () => {
    const addPayment = vi.fn(() => Promise.resolve(statement({ paid: '33000', balance: '0' })))
    mockApi.current = deepApiMock({
      'fees.settings': () => Promise.resolve({ currency: 'KES', payment_instructions: '' }),
      'schoolClasses.list': () => Promise.resolve([]), 'fees.balances': () => Promise.resolve(balances),
      'fees.statement': () => Promise.resolve(statement()), 'fees.addPayment': addPayment,
    })
    render(<Fees />)
    expect(await screen.findByText('KES 18,000 to pay')).toBeInTheDocument()
    expect(screen.getByText('Fully paid')).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /To confirm/ })).getByText('1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Amina K' }))
    expect(await screen.findByRole('heading', { name: 'Amina K' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Record a payment' }))
    const form = within(screen.getByRole('form', { name: 'Record a payment' }))
    fireEvent.change(form.getByLabelText('Amount (KES)'), { target: { value: '18000' } })
    fireEvent.change(form.getByLabelText('Reference'), { target: { value: 'RKT55X' } })
    fireEvent.click(form.getByRole('button', { name: 'Record and send receipt' }))
    await waitFor(() => expect(addPayment).toHaveBeenCalledWith(7, expect.objectContaining({ amount: '18000', method: 'mpesa', reference: 'RKT55X' })))
    expect(await screen.findByText(/receipt has been emailed/)).toBeInTheDocument()
    expect(screen.getAllByText('Fully paid').length).toBeGreaterThan(0)
  })

  it('cancels a payment with a reason, and adds a bursary', async () => {
    const voidPayment = vi.fn(() => Promise.resolve(statement({ payments: [{ ...statement().payments[0], voided: true, voided_by_name: 'Bursar', void_reason: 'Entered twice' }] })))
    const addCharge = vi.fn(() => Promise.resolve(statement()))
    vi.spyOn(window, 'prompt').mockReturnValue('Entered twice')
    mockApi.current = deepApiMock({
      'fees.settings': () => Promise.resolve({ currency: 'KES' }), 'schoolClasses.list': () => Promise.resolve([]),
      'fees.balances': () => Promise.resolve(balances), 'fees.statement': () => Promise.resolve(statement()),
      'fees.voidPayment': voidPayment, 'fees.addCharge': addCharge,
    })
    render(<Fees />)
    fireEvent.click(await screen.findByRole('button', { name: 'Amina K' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel receipt R2026-00001' }))
    await waitFor(() => expect(voidPayment).toHaveBeenCalledWith(5, 'Entered twice'))
    expect(await screen.findByText(/Cancelled by Bursar: Entered twice/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add a discount or charge' }))
    const form = within(screen.getByRole('form', { name: 'Add a discount or charge' }))
    fireEvent.change(form.getByLabelText('What for'), { target: { value: 'Bursary' } })
    fireEvent.change(form.getByLabelText('Amount (KES)'), { target: { value: '5000' } })
    fireEvent.click(form.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(addCharge).toHaveBeenCalledWith(7, { kind: 'discount', description: 'Bursary', amount: '5000' }))
  })

  it("adds a term's fee items and bills the term", async () => {
    let items = []
    const addItem = vi.fn((body) => { items = [{ id: 1, ...body, term_name: 'Term 3 2026', year_group_name: '', applies_to_label: 'Everyone', billed: 0 }]; return Promise.resolve(items[0]) })
    const billTerm = vi.fn(() => Promise.resolve({ created: 240 }))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi.current = deepApiMock({
      'fees.settings': () => Promise.resolve({ currency: 'KES' }),
      'terms.list': () => Promise.resolve([{ id: 3, name: 'Term 3 2026', start_date: '2000-01-01', end_date: '2100-01-01' }]),
      'yearGroups.list': () => Promise.resolve([{ id: 1, name: 'Form 1' }]),
      'fees.items': () => Promise.resolve(items), 'fees.addItem': addItem, 'fees.billTerm': billTerm,
      'schoolClasses.list': () => Promise.resolve([]), 'fees.balances': () => Promise.resolve(balances),
    })
    render(<Fees />)
    fireEvent.click(screen.getByRole('tab', { name: 'Fee structure' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Add a fee item' }))
    const form = within(screen.getByRole('form', { name: 'Add a fee item' }))
    fireEvent.change(form.getByLabelText('Name'), { target: { value: 'Tuition' } })
    fireEvent.change(form.getByLabelText('Amount (KES)'), { target: { value: '18000' } })
    fireEvent.click(form.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(addItem).toHaveBeenCalledWith({ name: 'Tuition', amount: '18000', year_group: null, applies_to: 'all', term: 3 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Bill this term' }))
    await waitFor(() => expect(billTerm).toHaveBeenCalledWith(3))
    expect(await screen.findByText('Done: 240 charges added.')).toBeInTheDocument()
  })

  it("confirms what a parent says they've paid", async () => {
    let open = [{ id: 9, student: 7, student_name: 'Amina K', class_name: '1 East', claimed_by_name: 'Pat Parent', amount: '18000',
      paid_on: '2026-10-08', method_label: 'M-Pesa', reference: 'RKT55X', note: '', created_at: '2026-10-08T10:00:00Z' }]
    const confirmClaim = vi.fn(() => { open = []; return Promise.resolve({}) })
    vi.spyOn(window, 'prompt').mockReturnValue('18000')
    mockApi.current = deepApiMock({
      'fees.settings': () => Promise.resolve({ currency: 'KES' }), 'schoolClasses.list': () => Promise.resolve([]),
      'fees.balances': () => Promise.resolve(balances), 'fees.claims': () => Promise.resolve(open), 'fees.confirmClaim': confirmClaim,
    })
    render(<Fees />)
    fireEvent.click(screen.getByRole('tab', { name: /To confirm/ }))
    expect(await screen.findByText('RKT55X')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Confirm Amina K's payment" }))
    await waitFor(() => expect(confirmClaim).toHaveBeenCalledWith(9, '18000'))
    expect(await screen.findByText(/Nothing to check/)).toBeInTheDocument()
  })
})

describe('a parent', () => {
  it("sees the balance and how to pay, says they've paid, and downloads a receipt", async () => {
    const fees = { ...statement(), payment_instructions: 'M-Pesa Paybill 247247' }
    const feeClaim = vi.fn((id, body) => Promise.resolve({ ...fees, claims: [{ id: 1, status: 'open', amount: body.amount, paid_on: body.paid_on, method_label: 'M-Pesa', reference: body.reference }] }))
    const feeReceipt = vi.fn(() => Promise.resolve())
    mockApi.current = deepApiMock({ 'guardianStudents.fees': () => Promise.resolve(fees), 'guardianStudents.feeClaim': feeClaim, 'guardianStudents.feeReceipt': feeReceipt })
    render(<ChildFees studentId={7} firstName="Amina" />)
    expect(await screen.findByText('KES 18,000 to pay')).toBeInTheDocument()
    expect(screen.getByText('M-Pesa Paybill 247247')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Download receipt R2026-00001' }))
    expect(feeReceipt).toHaveBeenCalledWith(7, 5)
    fireEvent.click(screen.getByRole('button', { name: "We've paid" }))
    const form = within(screen.getByRole('form', { name: "We've paid" }))
    fireEvent.change(form.getByLabelText('Amount (KES)'), { target: { value: '18000' } })
    fireEvent.change(form.getByLabelText('Reference'), { target: { value: 'RKT55X' } })
    fireEvent.click(form.getByRole('button', { name: 'Send to the school' }))
    await waitFor(() => expect(feeClaim).toHaveBeenCalledWith(7, expect.objectContaining({ amount: '18000', reference: 'RKT55X', method: 'mpesa' })))
    expect(await screen.findByText('The school is checking this payment.')).toBeInTheDocument()
  })
})

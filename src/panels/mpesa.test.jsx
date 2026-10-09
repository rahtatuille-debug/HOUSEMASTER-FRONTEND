// M-Pesa: the PIN prompt and waiting for it, the parent's and admin's buttons, and the bursar's set-up.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { deepApiMock } from '../test/apiMock.js'

const mockApi = { current: null }
vi.mock('../api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  get api() {
    return mockApi.current
  },
}))

const { default: MpesaPay } = await import('./MpesaPay.jsx')
const { default: ChildFees } = await import('./ChildFees.jsx')
const { default: FeesMpesa } = await import('./FeesMpesa.jsx')

afterEach(() => vi.useRealTimers())

describe('Pay with M-Pesa', () => {
  it('sends the prompt, waits, and says when it is paid', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = vi.fn(() => Promise.resolve({ id: 4, status: 'pending', amount: 15000, phone: '2547•••678' }))
    let calls = 0
    const check = vi.fn(() => Promise.resolve(++calls < 2 ? { id: 4, status: 'pending' } : { id: 4, status: 'paid', amount: 15000, receipt: 'SKD81QWERT' }))
    const onPaid = vi.fn()
    render(<MpesaPay start={start} check={check} defaultAmount="15000" onPaid={onPaid} />)
    const form = within(screen.getByRole('form', { name: 'Pay with M-Pesa' }))
    fireEvent.change(form.getByLabelText('M-Pesa phone number'), { target: { value: '0712345678' } })
    fireEvent.click(form.getByRole('button', { name: 'Send the prompt to my phone' }))
    await waitFor(() => expect(start).toHaveBeenCalledWith({ phone: '0712345678', amount: '15000' }))
    expect(await screen.findByText(/Enter your M-Pesa PIN on the prompt sent to 2547•••678/)).toBeInTheDocument()
    await act(async () => { await vi.advanceTimersByTimeAsync(9000) })
    expect(await screen.findByText(/Paid: KES 15,000 \(M-Pesa SKD81QWERT\)/)).toBeInTheDocument()
    expect(onPaid).toHaveBeenCalled()
  })

  it('says when it was not paid, so they can try again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const start = vi.fn(() => Promise.resolve({ id: 5, status: 'pending', amount: 100, phone: '2547•••678' }))
    const check = vi.fn(() => Promise.resolve({ id: 5, status: 'failed', message: 'Request cancelled by user' }))
    render(<MpesaPay start={start} check={check} fixedAmount={100} />)
    expect(screen.getByText('KES 100')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('M-Pesa phone number'), { target: { value: '0712345678' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the prompt to my phone' }))
    await waitFor(() => expect(start).toHaveBeenCalledWith({ phone: '0712345678' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(await screen.findByText(/Not paid: Request cancelled by user/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send the prompt to my phone' })).toBeInTheDocument()
  })

  it("shows the server's reason when the prompt can't be sent", async () => {
    const err = Object.assign(new Error('Bad request'), { data: { phone: ['Enter a Safaricom number, e.g. 0712 345 678.'] } })
    render(<MpesaPay start={() => Promise.reject(err)} check={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('M-Pesa phone number'), { target: { value: '123' } })
    fireEvent.change(screen.getByLabelText('Amount (KES)'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send the prompt to my phone' }))
    expect(await screen.findByText('Enter a Safaricom number, e.g. 0712 345 678.')).toBeInTheDocument()
  })
})

describe("a parent's Fees tab", () => {
  const fees = (mpesa) => ({ currency: 'KES', charged: '15000', paid: '0', balance: '15000', charges: [], payments: [], claims: [],
    payment_instructions: '', mpesa })

  it('shows the paybill and account, and opens Pay with M-Pesa with the balance', async () => {
    mockApi.current = deepApiMock({ 'guardianStudents.fees': () => Promise.resolve(fees({ kind: 'paybill', number: '123456', account: 'ADM20237' })) })
    render(<ChildFees studentId={7} firstName="Amina" />)
    expect(await screen.findByText('123456')).toBeInTheDocument()
    expect(screen.getByText('ADM20237')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pay with M-Pesa' }))
    expect(within(screen.getByRole('form', { name: 'Pay with M-Pesa' })).getByLabelText('Amount (KES)')).toHaveValue(15000)
  })

  it('has no M-Pesa button when the school has not connected it', async () => {
    mockApi.current = deepApiMock({ 'guardianStudents.fees': () => Promise.resolve(fees(null)) })
    render(<ChildFees studentId={7} firstName="Amina" />)
    expect(await screen.findByRole('button', { name: "We've paid" })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pay with M-Pesa' })).toBeNull()
  })
})

describe("the bursar's M-Pesa tab", () => {
  it('saves the paybill and keys, then connects', async () => {
    const saveMpesa = vi.fn(() => Promise.resolve({ connected: true, enabled: true, kind: 'paybill', shortcode: '123456', till_number: '',
      environment: 'sandbox', keys_saved: true, c2b_registered_at: null, currency_ok: true, server_ready: true }))
    const connectMpesa = vi.fn(() => Promise.resolve({ connected: true, enabled: true, kind: 'paybill', shortcode: '123456', till_number: '',
      environment: 'sandbox', keys_saved: true, c2b_registered_at: '2026-10-09T10:00:00Z', currency_ok: true, server_ready: true }))
    mockApi.current = deepApiMock({
      'fees.mpesa': () => Promise.resolve({ connected: false, enabled: false, kind: 'paybill', shortcode: '', till_number: '',
        environment: 'sandbox', keys_saved: false, c2b_registered_at: null, currency_ok: true, server_ready: true }),
      'fees.saveMpesa': saveMpesa, 'fees.connectMpesa': connectMpesa, 'fees.mpesaPayments': () => Promise.resolve([]),
    })
    render(<FeesMpesa />)
    const form = within(await screen.findByRole('form', { name: 'M-Pesa details' }))
    fireEvent.change(form.getByLabelText('Paybill number'), { target: { value: '123456' } })
    fireEvent.change(form.getByLabelText('Consumer key'), { target: { value: 'KEY' } })
    fireEvent.change(form.getByLabelText('Consumer secret'), { target: { value: 'SECRET' } })
    fireEvent.change(form.getByLabelText('Passkey'), { target: { value: 'PASS' } })
    fireEvent.click(form.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(saveMpesa).toHaveBeenCalledWith(expect.objectContaining({ kind: 'paybill', shortcode: '123456', consumer_key: 'KEY', passkey: 'PASS' })))
    fireEvent.click(await screen.findByRole('button', { name: 'Connect' }))
    await waitFor(() => expect(connectMpesa).toHaveBeenCalled())
    expect(await screen.findByText(/now recorded by themselves/)).toBeInTheDocument()
    expect(screen.getByText('Nothing to sort out.')).toBeInTheDocument()
  })

  it('gives an unmatched paybill payment to a student', async () => {
    let rows = [{ id: 3, trans_id: 'SKA2', amount: '3000', bill_ref: 'Amina form 1', payer_name: 'PAT', phone: '2547•••678',
      paid_at: '2026-10-09T07:15:00Z', status: 'unmatched', status_label: 'Needs a student' }]
    const assignMpesa = vi.fn(() => { rows = []; return Promise.resolve({}) })
    mockApi.current = deepApiMock({
      'fees.mpesa': () => Promise.resolve({ connected: true, enabled: true, kind: 'paybill', shortcode: '123456', environment: 'production',
        c2b_registered_at: '2026-10-09T06:00:00Z', currency_ok: true, server_ready: true }),
      'fees.mpesaPayments': () => Promise.resolve(rows), 'fees.assignMpesa': assignMpesa,
      'fees.balances': () => Promise.resolve({ students: [{ student: 7, name: 'Amina K', class_name: '1 East', external_id: 'ADM/2023/7' }] }),
    })
    render(<FeesMpesa />)
    expect(await screen.findByText('SKA2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Choose student' }))
    fireEvent.change(screen.getByLabelText('Student'), { target: { value: 'Amina' } })
    fireEvent.click(await screen.findByRole('button', { name: /Amina K · 1 East/ }))
    await waitFor(() => expect(assignMpesa).toHaveBeenCalledWith(3, 7))
    expect(await screen.findByText('Nothing to sort out.')).toBeInTheDocument()
  })
})

describe('an admin paying the subscription', () => {
  it('pays an invoice with M-Pesa from the Billing page', async () => {
    const { default: Billing } = await import('./Billing.jsx')
    const payMpesa = vi.fn(() => Promise.resolve({ id: 9, status: 'pending', amount: 15000, phone: '2547•••678' }))
    const invoice = { id: 4, number: 'HM-202610-0007-1', plan_name: 'Per student', students: 300, amount: '15000.00', currency: 'KES',
      period_start: '2026-10-01', period_end: '2026-10-31', issued_on: '2026-10-01', due_on: '2026-10-08', status: 'open', status_label: 'Unpaid',
      paid_on: null, school_reported_at: null }
    mockApi.current = deepApiMock({
      'billing.get': () => Promise.resolve({ status: 'due', label: 'Payment due', days_left: 2, exempt: false, grace_days: 14, students: 300,
        paid_until: null, plan: null, tiers: [], payment_instructions: '', invoices: [invoice], mpesa: { paybill: '600999', account: 'HM0007' } }),
      'billing.payMpesa': payMpesa, 'billing.mpesaStatus': () => Promise.resolve({ id: 9, status: 'pending' }),
    })
    render(<Billing />)
    expect(await screen.findByText('HM0007')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pay HM-202610-0007-1 with M-Pesa' }))
    const form = within(screen.getByRole('form', { name: 'Pay with M-Pesa' }))
    expect(form.getByText('KES 15,000')).toBeInTheDocument()
    fireEvent.change(form.getByLabelText('M-Pesa phone number'), { target: { value: '0712345678' } })
    fireEvent.click(form.getByRole('button', { name: 'Send the prompt to my phone' }))
    await waitFor(() => expect(payMpesa).toHaveBeenCalledWith(4, { phone: '0712345678' }))
    expect(await screen.findByText(/Check your phone/)).toBeInTheDocument()
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { api } from '../api.js'
import ForgotPassword from './ForgotPassword.jsx'

function reply(status, body, headers = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  }))
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('requestPasswordReset', () => {
  it('posts the email address, which is what /api/password-reset/ requires', async () => {
    globalThis.fetch = vi.fn(() => reply(200, { detail: 'If that account exists, a reset link has been sent.' }))
    await api.requestPasswordReset('parent@example.org')
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(new URL(url).pathname).toBe('/api/password-reset/')
    expect(JSON.parse(init.body)).toEqual({ email: 'parent@example.org' })
  })

  it('turns a 429 into a friendly "wait and try again" error', async () => {
    globalThis.fetch = vi.fn(() => reply(429, { detail: 'Request was throttled. Expected available in 1800 seconds.' },
      { 'Retry-After': '1800' }))
    const error = await api.requestPasswordReset('parent@example.org').catch((e) => e)
    expect(error.status).toBe(429)
    expect(error.message).toMatch(/too many/i)
    expect(error.message).toMatch(/30 minutes/)
  })
})

describe('ForgotPassword screen', () => {
  it('asks for an email address and shows the same neutral message on success', async () => {
    globalThis.fetch = vi.fn(() => reply(200, { detail: 'ok' }))
    render(<ForgotPassword onBack={() => {}} />)
    const input = screen.getByLabelText('Email address')
    expect(input).toHaveAttribute('type', 'email')
    fireEvent.change(input, { target: { value: 'someone@example.org' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText("If that email has an account, we've sent a reset link to it.")).toBeInTheDocument()
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({ email: 'someone@example.org' })
  })

  it('shows a please-wait message when rate limited, and stays on the form', async () => {
    globalThis.fetch = vi.fn(() => reply(429, { detail: 'Request was throttled.' }, { 'Retry-After': '90' }))
    render(<ForgotPassword onBack={() => {}} />)
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'someone@example.org' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await screen.findByText(/too many reset requests.*2 minutes/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })
})

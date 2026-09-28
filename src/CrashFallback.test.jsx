import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ErrorBoundary } from './sentry.js'
import CrashFallback from './CrashFallback.jsx'

function Broken() {
  throw new Error('render failed')
}

describe('crash boundary', () => {
  it('shows the reload screen instead of a blank page when rendering fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<CrashFallback />}>
        <Broken />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })
})

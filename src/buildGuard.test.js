// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { checkProductionEnv } from '../vite.config.js'

describe('production build guard', () => {
  it('stops a Vercel production build without the API address', () => {
    expect(() => checkProductionEnv({}, 'production')).toThrow(/VITE_API_BASE_URL/)
  })

  it('warns, but builds, without the Sentry DSN', () => {
    const warn = vi.fn()
    checkProductionEnv({ VITE_API_BASE_URL: 'https://api.example.org' }, 'production', warn)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/VITE_SENTRY_DSN/))
  })

  it('leaves preview builds and local development alone', () => {
    expect(() => checkProductionEnv({}, 'preview')).not.toThrow()
    expect(() => checkProductionEnv({}, undefined)).not.toThrow()
  })
})

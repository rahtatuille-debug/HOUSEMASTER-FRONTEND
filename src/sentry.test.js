import { describe, expect, it } from 'vitest'

import { scrub, scrubText } from './sentry'

describe('Sentry scrubbing', () => {
  it('removes the secret from every token-bearing address', () => {
    const cases = {
      'https://app.example/join/Zx9-abc': 'https://app.example/join/[Filtered]',
      'https://app.example/staff-join/Zx9-abc/': 'https://app.example/staff-join/[Filtered]/',
      '/invite/abc123': '/invite/[Filtered]',
      '/guardian-invite/abc123': '/guardian-invite/[Filtered]',
      '/apply/confirm/abc123': '/apply/confirm/[Filtered]',
      '/apply/abc123': '/apply/[Filtered]',
      '/reset-password/abc123': '/reset-password/[Filtered]',
      '/api/invites/preview/abc123/': '/api/invites/preview/[Filtered]/',
      '/api/admissions/confirm/abc123/': '/api/admissions/confirm/[Filtered]/',
      '/api/calendar/ical/abc123.ics': '/api/calendar/ical/[Filtered]',
      '/login?next=/x&token=abc': '/login?next=/x&token=[Filtered]',
    }
    for (const [raw, clean] of Object.entries(cases)) expect(scrubText(raw)).toBe(clean)
  })

  it('leaves ordinary addresses alone', () => {
    expect(scrubText('/api/students/12/?page=2')).toBe('/api/students/12/?page=2')
    expect(scrubText('https://app.example/')).toBe('https://app.example/')
  })

  it('scrubs a whole event: page address, breadcrumbs and tags', () => {
    const event = {
      request: { url: 'https://app.example/join/SECRET1' },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/join/SECRET1/', status_code: 500 } }],
      tags: { 'api.path': '/api/staff-join/SECRET2/' },
    }
    const clean = JSON.stringify(scrub(event))
    expect(clean).not.toContain('SECRET')
    expect(scrub(event).breadcrumbs[0].data.status_code).toBe(500)
  })
})

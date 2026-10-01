// The short privacy notice on the sign-up forms and the Profile page must say
// what HouseMaster actually does.
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyNotice from './PrivacyNotice.jsx'
import { countryFor } from '../countries.js'

describe('Privacy notice', () => {
  it("says the AI gets a placeholder, not the student's name", () => {
    render(<PrivacyNotice schoolName="Alpha School" />)
    expect(screen.getByText(/name replaced by a placeholder/)).toBeInTheDocument()
    expect(screen.queryByText(/student's name, grades and attendance .* are sent/)).toBeNull()
  })

  it("names HouseMaster's email service, hosting abroad, the device and how long data is kept", () => {
    render(<PrivacyNotice schoolName="Alpha School" country={countryFor('ke')} />)
    expect(screen.getByText(/HouseMaster's email service/)).toBeInTheDocument()
    expect(screen.queryByText(/school's email provider/)).toBeNull()
    expect(screen.getByText(/may be outside\s+Kenya/)).toBeInTheDocument()
    expect(screen.getByText(/cleared when you sign out/)).toBeInTheDocument()
    expect(screen.getByText('How long it is kept')).toBeInTheDocument()
    expect(screen.getByText(/the Office of the Data Protection Commissioner/)).toBeInTheDocument()
  })

  it('mentions extra support for parents and staff, and the school contact', () => {
    const { unmount } = render(<PrivacyNotice schoolName="Alpha" contact="office@alpha.example" />)
    expect(screen.getByText(/any extra support the school is giving/)).toBeInTheDocument()
    expect(screen.getByText('office@alpha.example')).toBeInTheDocument()
    unmount()
    render(<PrivacyNotice schoolName="Alpha" audience="staff" country={countryFor('other')} />)
    expect(screen.getByText(/students who need extra support/)).toBeInTheDocument()
    expect(screen.getByText(/may be outside\s+your country/)).toBeInTheDocument()
  })
})

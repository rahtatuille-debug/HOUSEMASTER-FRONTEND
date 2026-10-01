import { countryFor } from '../countries.js'

// The privacy notice shown before anyone creates an account, and on the
// Profile page. The school is the data controller and HouseMaster processes
// data on its behalf; the law and regulator named depend on the school's
// country (Kenya unless the school says otherwise).
export default function PrivacyNotice({ schoolName, contact, country, audience = 'parent' }) {
  const school = schoolName || 'Your school'
  const where = country?.law ? country : countryFor('ke')
  return (
    <div className="privacy-notice">
      <h3>How {schoolName || 'your school'} uses personal data</h3>
      <p>
        {school} uses HouseMaster to run the school and keep in touch with families. The school decides how your
        personal data is used and is responsible for it under {where.law}. HouseMaster stores and handles it only
        on the school&apos;s behalf, and never sells it or uses it for advertising.
      </p>
      <h4>What is held</h4>
      <p>
        {audience === 'staff'
          ? 'Your name, email address, role and the classes you teach, and the work you record: grades, attendance, reports, notes about students who need extra support, and messages.'
          : "Your name, email address and any contact details you or the school add, and your children's details: name, class, date of birth, health notes, photo, grades, attendance, reports, any extra support the school is giving, and messages with the school."}
      </p>
      <h4>Who can see it</h4>
      <p>
        The school&apos;s administrators. Teachers see the students in the classes they teach and their parents&apos;
        contact details. Parents see only their own children. Nothing is shared with other schools.
      </p>
      <h4>Services that help run HouseMaster</h4>
      <ul>
        <li>
          <strong>Hosting:</strong> the data is stored and handled by cloud providers, which may be outside{' '}
          {where.code && where.code !== 'other' ? where.name : 'your country'}. Encrypted backups are kept for 90 days.
        </li>
        <li><strong>Email:</strong> invitations, password resets and school notices are sent through HouseMaster&apos;s email service.</li>
        <li>
          <strong>Writing help:</strong> when staff ask for help drafting a report comment, Google&apos;s Gemini AI
          receives the marks and attendance with the student&apos;s name replaced by a placeholder. For announcements
          it receives the brief, with known names and email addresses masked. Staff check every draft before it is used.
        </li>
        <li><strong>Error reports:</strong> when something breaks, technical details are sent to an error-tracking service so it can be fixed.</li>
      </ul>
      <h4>On your device</h4>
      <p>
        Your sign-in, and anything you have typed but not yet saved (for example a register on a weak signal), are
        kept in this browser so they aren&apos;t lost. They are cleared when you sign out; unsaved work is also
        cleared after a week. HouseMaster uses no advertising or tracking cookies.
      </p>
      <h4>How long it is kept</h4>
      <p>
        While the student or family is with the school. The school can delete a family&apos;s data, and can choose
        how long after a student leaves their records are anonymised.
      </p>
      <h4>Your rights</h4>
      <p>
        You can ask the school for a copy of the data held about you or your child, to correct it, or to delete it.
        {contact ? <> Contact <strong>{contact}</strong>.</> : ' Contact the school office.'} If data is lost or
        exposed, the school is told so it can let you know. You can also complain to {where.regulator}.
      </p>
    </div>
  )
}

// The tick box that goes with the notice on the sign-up forms.
export function PrivacyConsent({ checked, onChange }) {
  return (
    <label className="checkbox-label privacy-consent">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} required />
      I have read the privacy notice above and agree to my data being used as described.
    </label>
  )
}

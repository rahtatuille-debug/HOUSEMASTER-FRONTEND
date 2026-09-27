// The privacy notice shown before anyone creates an account, and on the
// Profile page. Written for the Kenya Data Protection Act 2019: the school is
// the data controller and HouseMaster processes data on its behalf.
export default function PrivacyNotice({ schoolName, contact, audience = 'parent' }) {
  const school = schoolName || 'Your school'
  return (
    <div className="privacy-notice">
      <h3>How {school} uses personal data</h3>
      <p>
        {school} uses HouseMaster to run the school and keep in touch with families. The school is responsible for
        your personal data under Kenya's Data Protection Act, 2019. HouseMaster stores and processes it only on the
        school's behalf.
      </p>
      <h4>What is held</h4>
      <p>
        {audience === 'staff'
          ? 'Your name, email address, role and the classes you teach, and the work you record (grades, attendance, reports and messages).'
          : "Your name, email address and any contact details you or the school add, and your children's details: name, class, date of birth, health notes, photo, grades, attendance, reports and messages with the school."}
      </p>
      <h4>Who can see it</h4>
      <p>
        The school's administrators. Teachers see the students in the classes they teach and their parents' phone
        numbers. Parents see only their own children. Nothing is shared with other schools.
      </p>
      <h4>Other services used</h4>
      <p>
        Emails are sent through the school's email provider. When staff ask for help drafting a report comment or
        an announcement, the student's name, grades and attendance (or the announcement brief) are sent to Google's
        Gemini AI service to write the suggested wording. The suggestion is always reviewed by staff before use.
      </p>
      <h4>Your rights</h4>
      <p>
        You can ask the school for a copy of the data held about you or your child, to correct it, or to delete it.
        {contact ? <> Contact <strong>{contact}</strong>.</> : ' Contact the school office.'} You can also complain to
        the Office of the Data Protection Commissioner (ODPC).
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

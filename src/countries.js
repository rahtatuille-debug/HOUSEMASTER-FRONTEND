// Where a school is: the privacy law it follows and local formats. Mirrors
// COUNTRIES in the backend's students/presets.py, which is what signed-in
// pages and invite pages receive; this copy is only for the sign-up page,
// before the school exists.
export const COUNTRIES = [
  { code: 'ke', name: 'Kenya', locale: 'en-KE', phone_example: '+254 712 345 678',
    law: "Kenya's Data Protection Act, 2019", regulator: 'the Office of the Data Protection Commissioner (ODPC)' },
  { code: 'gb', name: 'United Kingdom', locale: 'en-GB', phone_example: '+44 7700 900123',
    law: 'the UK GDPR and the Data Protection Act 2018', regulator: "the Information Commissioner's Office (ICO)" },
  { code: 'us', name: 'United States', locale: 'en-US', phone_example: '+1 555 010 0123',
    law: "the Family Educational Rights and Privacy Act (FERPA) and your state's student privacy laws",
    regulator: "the US Department of Education's Student Privacy Policy Office" },
  { code: 'other', name: 'Another country', locale: 'en-GB', phone_example: '+000 000 000 000',
    law: 'the data protection laws of your country', regulator: 'your national data protection authority' },
]

export const countryFor = (code) => COUNTRIES.find((c) => c.code === code) || COUNTRIES[0]

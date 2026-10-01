// The label next to a student's name: confirmed by a teacher ("Needs support")
// or only suggested by HouseMaster ("Check: may need support"; staff only).
export default function SupportBadge({ status }) {
  if (status === 'open' || status === true) {
    return <span className="badge support" style={{ marginLeft: 6 }}>Needs support</span>
  }
  if (status === 'suggested') {
    return <span className="badge support-suggested" style={{ marginLeft: 6 }} title="HouseMaster found warning signs. Confirm or dismiss on the Needs support page.">May need support</span>
  }
  return null
}

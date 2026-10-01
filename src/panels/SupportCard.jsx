// A confirmed support concern: why the student was marked, the teacher's
// note and the support plan. Parents see this on their child's page; staff
// see it (with the review date) on the student profile.
export default function SupportCard({ concern, forParents, formatDate }) {
  if (!concern) return null
  return (
    <div className="support-box" role="region" aria-label="Extra support">
      <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>{forParents ? 'Extra support' : 'Needs support'}</h3>
      {forParents && (
        <p style={{ margin: '0 0 6px' }}>
          The school is giving extra support and would like to work on it with you.
        </p>
      )}
      {concern.reasons?.length > 0 && (
        <ul className="support-reasons" style={{ margin: '0 0 6px' }}>
          {concern.reasons.map((r) => <li key={r.code}>{r.label}</li>)}
        </ul>
      )}
      {concern.note && <p style={{ margin: '0 0 6px' }}>{concern.note}</p>}
      {concern.support_plan && <p style={{ margin: '0 0 6px' }}><strong>Support plan:</strong> {concern.support_plan}</p>}
      {forParents ? (
        <p className="hint" style={{ margin: 0 }}>Questions? Send the teacher a message from the Messages page.</p>
      ) : (
        <p className="hint" style={{ margin: 0 }}>
          Marked by {concern.created_by_name || 'staff'}
          {concern.review_date && formatDate ? ` · Review ${formatDate(concern.review_date)}` : ''}
          {' · '}Change it on the Needs support page.
        </p>
      )}
    </div>
  )
}

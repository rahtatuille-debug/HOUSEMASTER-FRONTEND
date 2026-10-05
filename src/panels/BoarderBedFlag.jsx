// On the student page: a boarder who hasn't been given a bed yet (e.g. just enrolled from admissions).
export default function BoarderBedFlag({ boarding }) {
  if (!boarding?.boarder_without_bed) return null
  return (
    <div className="card support-box" role="status" style={{ marginBottom: 18 }}>
      <strong>Needs a bed.</strong> This student is a boarder but has no bed yet. Put them in one on Boarding, Boarding houses and beds.
    </div>
  )
}

// "Showing 50 of 1,240 · Show 50 more" under a long list, so pages stay quick
// to load and scroll, especially on phones.
// Phones get shorter pages; each row there is a card.
export const PAGE = typeof window !== 'undefined' && window.innerWidth <= 640 ? 20 : 50

export default function ShowMore({ shown, total, onMore, noun = 'rows', step = PAGE }) {
  if (total <= step) return null
  return (
    <div className="show-more">
      <span className="text-muted">Showing {Math.min(shown, total).toLocaleString()} of {total.toLocaleString()} {noun}</span>
      {shown < total && (
        <button type="button" className="secondary" onClick={onMore}>
          Show {Math.min(step, total - shown)} more
        </button>
      )}
    </div>
  )
}

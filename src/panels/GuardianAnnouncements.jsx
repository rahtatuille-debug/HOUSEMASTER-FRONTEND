import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { announcementAuthor } from '../user.js'

const audienceLabels = {
  all_parents: 'All parents',
  year_group: 'Year group',
  school_class: 'Class',
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function GuardianAnnouncements() {
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      setItems(await api.announcements.list())
    } catch (err) {
      setError(err.status === 403 ? 'You do not have access to school announcements.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (selected) return (
    <section>
      <div className="panel-header"><button type="button" className="back-button" onClick={() => setSelected(null)}>← Communications</button></div>
      <article className="announcement-detail card">
        <div className="announcement-detail-heading"><div><p className="eyebrow">{audienceLabels[selected.audience] || 'School announcement'}</p><h2>{selected.title}</h2></div></div>
        <div className="announcement-body">{selected.body}</div>
        <dl className="announcement-meta"><div><dt>Audience</dt><dd>{audienceLabels[selected.audience] || 'School announcement'}</dd></div><div><dt>Author</dt><dd>{announcementAuthor(selected)}</dd></div><div><dt>Published</dt><dd>{formatDate(selected.published_at)}</dd></div></dl>
      </article>
    </section>
  )

  return (
    <section>
      <div className="panel-header"><div><h2>Communications</h2><p className="text-muted">Important notices from your school.</p></div></div>
      {error && <div className="error-banner">{error}<button type="button" className="secondary retry-button" onClick={load}>Retry</button></div>}
      {loading ? <div className="announcement-skeleton" aria-label="Loading announcements"><span /><span /></div> : items.length === 0 ? <div className="empty-state"><h3>No school announcements for you yet.</h3></div> : <div className="announcement-list">{items.map((item) => <button className="announcement-card" key={item.id} onClick={() => setSelected(item)}><div className="announcement-card-top"><span className="eyebrow">{audienceLabels[item.audience] || 'School announcement'}</span></div><h3>{item.title}</h3><p>{item.body}</p><div className="announcement-card-footer"><span>{announcementAuthor(item)}</span><span>Published {formatDate(item.published_at)}</span></div></button>)}</div>}
    </section>
  )
}

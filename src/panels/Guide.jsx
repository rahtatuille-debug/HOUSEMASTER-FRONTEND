import { guideSections } from '../guide.js'
import { useVocab } from '../levels.js'

// How to use every part of HouseMaster, for the signed-in person's role.
export default function Guide({ me, onNavigate, onStartTour }) {
  const words = useVocab()
  const sections = guideSections(words, me?.role === 'admin' ? 'admin' : 'teacher')
  return (
    <div>
      <div className="panel-header">
        <div>
          <h2>Guide</h2>
          <p className="text-muted" style={{ margin: '4px 0 0' }}>How to use each part of HouseMaster.</p>
        </div>
        <button type="button" className="secondary" style={{ width: 'auto' }} onClick={onStartTour}>Take the tour</button>
      </div>
      <nav aria-label="Guide contents">
        <ul className="guide-toc">
          {sections.map((s) => <li key={s.key}><a href={`#guide-${s.key}`}>{s.title}</a></li>)}
        </ul>
      </nav>
      {sections.map((s) => (
        <section className="card guide-section" id={`guide-${s.key}`} key={s.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <h3>{s.title}</h3>
            <button type="button" className="link-button" style={{ width: 'auto', padding: 0 }} onClick={() => onNavigate(s.key)}>
              Open {s.title}
            </button>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>{s.tour}</p>
          <ol>{s.steps.map((line) => <li key={line}>{line}</li>)}</ol>
        </section>
      ))}
    </div>
  )
}

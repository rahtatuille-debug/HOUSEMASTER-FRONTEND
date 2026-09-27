import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'

const STEPS = ['School details', 'Education system', 'Levels', 'Classes', 'Subjects', 'Terms', 'Grading and reports', 'Review']
const TONES = { formal: 'Formal', warm: 'Warm and encouraging', concise: 'Concise and direct' }

// The choices that follow from picking an education system and its stages.
function defaultsFor(system, stageKeys) {
  const stages = system.stages.filter((s) => stageKeys.includes(s.key))
  const subjects = [...new Set(stages.flatMap((s) => s.subjects))]
  const special = [...new Set(stages.map((s) => s.scale || null))]
  return {
    year_groups: stages.flatMap((s) => s.year_groups).map((name) => ({ name, classes: [name] })),
    subjects,
    subjectOptions: subjects,
    grading_scale: special.length === 1 && special[0] ? special[0] : system.scales[0],
  }
}

function splitList(text) {
  return text.split(',').map((x) => x.trim()).filter(Boolean)
}

// Everything a new school has to choose before it can use HouseMaster. The
// answers are saved as the admin goes, so they can leave and come back.
export default function SetupWizard({ me, onFinished, onLogout }) {
  const [catalogue, setCatalogue] = useState(null)
  const [answers, setAnswers] = useState(null)
  const [streams, setStreams] = useState('')
  const [newSubject, setNewSubject] = useState('')
  const [newYearGroup, setNewYearGroup] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(null)
  const topRef = useRef(null)

  useEffect(() => {
    api.setup.state().then((data) => {
      setCatalogue(data)
      const saved = data.school.setup_progress || {}
      const fresh = {
        step: 0,
        school: { name: data.school.name, motto: data.school.motto, address: data.school.address,
          phone: data.school.phone, email: data.school.email, privacy_contact: data.school.privacy_contact,
          country: data.school.country },
        education_system: '', stages: [], year_groups: [], subjects: [], subjectOptions: [], terms: [],
        grading_scale: data.school.grading_scale, report_tone: data.school.report_tone,
      }
      // Older saved answers may not have a country yet; keep the school's own.
      setAnswers(saved.step != null ? { ...saved, school: { country: data.school.country, ...saved.school } } : fresh)
    }).catch((err) => setError(err.message))
  }, [])

  if (error && !answers) return <div className="setup-wrap"><div className="error-banner">{error}</div></div>
  if (!catalogue || !answers) return <div className="setup-wrap"><p className="text-muted">Loading…</p></div>

  const system = catalogue.systems.find((s) => s.key === answers.education_system)
  const update = (changes) => setAnswers((a) => ({ ...a, ...changes }))
  const step = answers.step

  function chooseSystem(key) {
    if (key === answers.education_system) return
    const next = catalogue.systems.find((s) => s.key === key)
    const stages = next.stages.map((s) => s.key)
    update({ education_system: key, stages, terms: next.terms, assessments: next.assessments || [], ...defaultsFor(next, stages) })
  }

  function toggleStage(key) {
    const stages = answers.stages.includes(key) ? answers.stages.filter((k) => k !== key) : [...answers.stages, key]
    const ordered = system.stages.map((s) => s.key).filter((k) => stages.includes(k))
    update({ stages: ordered, ...defaultsFor(system, ordered) })
  }

  // What stops the admin moving on from each step.
  function problem() {
    if (step === 0 && answers.school.name.trim().length < 2) return 'Enter the school name.'
    if (step === 1 && !system) return 'Choose an education system.'
    if (step === 2 && !answers.year_groups.length) return 'Choose at least one level or add a year group.'
    if (step === 3 && answers.year_groups.some((g) => !g.classes.length)) return 'Every year group needs at least one class.'
    if (step === 4 && !answers.subjects.length) return 'Choose at least one subject.'
    if (step === 5) {
      if (!answers.terms.length) return 'Add at least one term.'
      const bad = answers.terms.find((t) => !t.name.trim() || !t.start_date || !t.end_date || t.end_date <= t.start_date)
      if (bad) return `Check "${bad.name || 'a term'}": it needs a name, and must end after it starts.`
    }
    return ''
  }

  async function go(delta) {
    const issue = delta > 0 ? problem() : ''
    setError(issue)
    if (issue) return
    const next = { ...answers, step: step + delta }
    setAnswers(next)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    api.setup.saveProgress(next).catch(() => {}) // best effort; they can carry on either way
  }

  async function finish() {
    setSaving(true)
    setError('')
    try {
      const result = await api.setup.finish({
        ...answers.school, education_system: answers.education_system, year_groups: answers.year_groups,
        subjects: answers.subjects, terms: answers.terms, grading_scale: answers.grading_scale,
        report_tone: answers.report_tone,
        assessments: (answers.assessments || []).filter((a) => a.name.trim()).map((a) => ({ name: a.name.trim(), weight: Number(a.weight) || 0 })),
      })
      setDone(result.created)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (done) {
    return (
      <div className="setup-wrap">
        <div className="card setup-card">
          <p className="eyebrow">Setup complete</p>
          <h2>{answers.school.name} is ready</h2>
          <p>
            Added {done.year_groups} year groups, {done.classes} classes, {done.subjects} subjects and {done.terms} terms.
            You can change any of it later in Setup.
          </p>
          <h3 style={{ fontSize: 15, margin: '18px 0 6px' }}>Next steps</h3>
          <ol className="setup-next">
            <li><strong>Invite your staff</strong> on the Staff page, one at a time or from an Excel sheet with their classes.</li>
            <li><strong>Add your students</strong> in Setup, by hand or with the Excel import.</li>
            <li><strong>Invite parents</strong> on the Parents page once students are in.</li>
          </ol>
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button type="button" onClick={onFinished}>Go to HouseMaster</button>
          </div>
        </div>
      </div>
    )
  }

  const scales = catalogue.scales.filter((s) => !system || system.scales.includes(s.key))

  return (
    <div className="setup-wrap" ref={topRef}>
      <div className="setup-header">
        <div>
          <p className="eyebrow">Set up {answers.school.name || 'your school'}</p>
          <h2>{STEPS[step]}</h2>
        </div>
        <button type="button" className="secondary" onClick={onLogout}>Save and sign out</button>
      </div>
      <ol className="setup-steps" aria-label="Setup steps">
        {STEPS.map((label, i) => (
          <li key={label} className={i === step ? 'current' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>
            <span>{i + 1}</span> {label}
          </li>
        ))}
      </ol>

      <div className="card setup-card">
        {error && <div className="error-banner">{error}</div>}

        {step === 0 && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>These appear on report cards and in messages to parents.</p>
            {[['name', 'School name'], ['motto', 'Motto (optional)'], ['phone', 'Phone'], ['email', 'School email'],
              ['privacy_contact', 'Privacy contact (who people ask about their data)']].map(([key, label]) => (
              <div className="field" key={key}>
                <label htmlFor={`setup-${key}`}>{label}</label>
                <input id={`setup-${key}`} type={key === 'email' ? 'email' : 'text'} value={answers.school[key] || ''}
                  onChange={(e) => update({ school: { ...answers.school, [key]: e.target.value } })} />
              </div>
            ))}
            <div className="field">
              <label htmlFor="setup-country">Country</label>
              <select id="setup-country" value={answers.school.country || 'ke'}
                onChange={(e) => update({ school: { ...answers.school, country: e.target.value } })}>
                {catalogue.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
              <p className="hint" style={{ margin: '4px 0 0' }}>Decides which privacy law your privacy notice refers to, and how dates are shown.</p>
            </div>
            <div className="field">
              <label htmlFor="setup-address">Address</label>
              <textarea id="setup-address" rows={2} value={answers.school.address || ''}
                onChange={(e) => update({ school: { ...answers.school, address: e.target.value } })} />
            </div>
          </>
        )}

        {step === 1 && (
          <div className="system-options">
            {catalogue.systems.map((s) => (
              <button type="button" key={s.key} className={`system-option${answers.education_system === s.key ? ' selected' : ''}`}
                aria-pressed={answers.education_system === s.key} onClick={() => chooseSystem(s.key)}>
                <span className="eyebrow">{s.country}</span>
                <strong>{s.name}</strong>
                <span>{s.description}</span>
              </button>
            ))}
          </div>
        )}

        {step === 2 && system && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>Tick the levels your school teaches. You can rename, remove or add year groups below.</p>
            <div className="checkbox-list setup-stages">
              {system.stages.map((s) => (
                <label key={s.key} className="checkbox-label">
                  <input type="checkbox" checked={answers.stages.includes(s.key)} onChange={() => toggleStage(s.key)} />
                  <span><strong>{s.name}</strong> <span className="text-muted">({s.year_groups.join(', ')})</span></span>
                </label>
              ))}
            </div>
            <h3 style={{ fontSize: 14, margin: '18px 0 8px' }}>Year groups</h3>
            {answers.year_groups.map((g, i) => (
              <div className="setup-row" key={i}>
                <input aria-label={`Year group ${i + 1}`} value={g.name} onChange={(e) => {
                  const year_groups = [...answers.year_groups]
                  const old = g.name
                  year_groups[i] = { name: e.target.value, classes: g.classes.map((c) => (c === old ? e.target.value : c)) }
                  update({ year_groups })
                }} />
                <button type="button" className="secondary" onClick={() => update({ year_groups: answers.year_groups.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <form className="setup-row" onSubmit={(e) => {
              e.preventDefault()
              if (!newYearGroup.trim()) return
              update({ year_groups: [...answers.year_groups, { name: newYearGroup.trim(), classes: [newYearGroup.trim()] }] })
              setNewYearGroup('')
            }}>
              <input aria-label="New year group" placeholder="Add a year group" value={newYearGroup} onChange={(e) => setNewYearGroup(e.target.value)} />
              <button type="submit" className="secondary">Add</button>
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>
              If a year group is split into streams, type the stream names once (e.g. <em>East, West</em> or <em>A, B, C</em>) and apply
              them, or edit each year group's classes separately. One class per year group is fine too.
            </p>
            <div className="setup-row">
              <input aria-label="Stream names" placeholder="Stream names, e.g. East, West" value={streams} onChange={(e) => setStreams(e.target.value)} />
              <button type="button" className="secondary" disabled={!splitList(streams).length} onClick={() => update({
                year_groups: answers.year_groups.map((g) => ({ ...g, classes: splitList(streams).map((s) => `${g.name} ${s}`) })),
              })}>Apply to all</button>
              <button type="button" className="secondary" onClick={() => update({
                year_groups: answers.year_groups.map((g) => ({ ...g, classes: [g.name] })),
              })}>One class each</button>
            </div>
            <table style={{ marginTop: 12 }}>
              <thead><tr><th>Year group</th><th>Classes (separate with commas)</th></tr></thead>
              <tbody>
                {answers.year_groups.map((g, i) => (
                  <tr key={i}>
                    <td>{g.name}</td>
                    <td>
                      <input aria-label={`Classes in ${g.name}`} value={g.classes.join(', ')} onChange={(e) => {
                        const year_groups = [...answers.year_groups]
                        year_groups[i] = { ...g, classes: e.target.value.split(',').map((x) => x.trimStart()) }
                        update({ year_groups })
                      }} onBlur={() => {
                        const year_groups = [...answers.year_groups]
                        year_groups[i] = { ...g, classes: g.classes.map((c) => c.trim()).filter(Boolean) }
                        update({ year_groups })
                      }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {step === 4 && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>The usual subjects for the levels you chose. Untick any you don't teach and add your own.</p>
            <div className="checkbox-list setup-subjects">
              {[...new Set([...answers.subjectOptions, ...answers.subjects])].map((name) => (
                <label key={name} className="checkbox-label">
                  <input type="checkbox" checked={answers.subjects.includes(name)} onChange={() => update({
                    subjects: answers.subjects.includes(name) ? answers.subjects.filter((x) => x !== name) : [...answers.subjects, name],
                  })} />
                  {name}
                </label>
              ))}
            </div>
            <form className="setup-row" style={{ marginTop: 12 }} onSubmit={(e) => {
              e.preventDefault()
              const name = newSubject.trim()
              if (!name) return
              update({ subjects: answers.subjects.includes(name) ? answers.subjects : [...answers.subjects, name],
                subjectOptions: answers.subjectOptions.includes(name) ? answers.subjectOptions : [...answers.subjectOptions, name] })
              setNewSubject('')
            }}>
              <input aria-label="New subject" placeholder="Add a subject" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
              <button type="submit" className="secondary">Add</button>
            </form>
          </>
        )}

        {step === 5 && (
          <>
            <p className="hint" style={{ marginTop: 0 }}>This school year's terms, with the usual dates for {system?.name}. Change them to match your calendar.</p>
            <div className="table-scroll">
              <table>
                <thead><tr><th>Name</th><th>Starts</th><th>Ends</th><th /></tr></thead>
                <tbody>
                  {answers.terms.map((t, i) => {
                    const change = (key) => (e) => {
                      const terms = [...answers.terms]
                      terms[i] = { ...t, [key]: e.target.value }
                      update({ terms })
                    }
                    return (
                      <tr key={i}>
                        <td><input aria-label={`Term ${i + 1} name`} value={t.name} onChange={change('name')} /></td>
                        <td><input aria-label={`Term ${i + 1} start`} type="date" value={t.start_date} onChange={change('start_date')} /></td>
                        <td><input aria-label={`Term ${i + 1} end`} type="date" value={t.end_date} onChange={change('end_date')} /></td>
                        <td><button type="button" className="secondary" onClick={() => update({ terms: answers.terms.filter((_, j) => j !== i) })}>Remove</button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <button type="button" className="secondary" style={{ marginTop: 10 }}
              onClick={() => update({ terms: [...answers.terms, { name: `Term ${answers.terms.length + 1}`, start_date: '', end_date: '' }] })}>
              Add a term
            </button>
          </>
        )}

        {step === 6 && (
          <>
            <h3 style={{ fontSize: 14, margin: '0 0 8px' }}>How results are graded</h3>
            <p className="hint" style={{ marginTop: 0 }}>Marks are always kept as percentages; the grade or level is shown next to them.</p>
            {scales.map((s) => (
              <label key={s.key} className="checkbox-label setup-scale">
                <input type="radio" name="scale" checked={answers.grading_scale === s.key} onChange={() => update({ grading_scale: s.key })} />
                <span><strong>{s.label}</strong>{s.key_text && <span className="text-muted"> · {s.key_text}</span>}</span>
              </label>
            ))}
            <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>How marks are weighted</h3>
            <p className="hint" style={{ marginTop: 0 }}>
              Teachers tag each mark with one of these, and a subject's term result combines them by weight.
              Change them to match your school, or remove them all to simply average every mark.
            </p>
            {(answers.assessments || []).map((a, i) => (
              <div className="setup-row" key={i}>
                <input aria-label={`Assessment ${i + 1} name`} value={a.name} onChange={(e) => {
                  const assessments = [...answers.assessments]
                  assessments[i] = { ...a, name: e.target.value }
                  update({ assessments })
                }} />
                <input aria-label={`Assessment ${i + 1} weight`} type="number" min="0" max="100" style={{ maxWidth: 90 }} value={a.weight}
                  onChange={(e) => {
                    const assessments = [...answers.assessments]
                    assessments[i] = { ...a, weight: e.target.value }
                    update({ assessments })
                  }} />
                <span className="text-muted" style={{ alignSelf: 'center' }}>%</span>
                <button type="button" className="secondary" onClick={() => update({ assessments: answers.assessments.filter((_, j) => j !== i) })}>Remove</button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => update({ assessments: [...(answers.assessments || []), { name: '', weight: '' }] })}>
              Add an assessment type
            </button>
            {(answers.assessments || []).length > 0 && (
              <p className="hint">Total: {(answers.assessments || []).reduce((sum, a) => sum + (Number(a.weight) || 0), 0)}%</p>
            )}

            <h3 style={{ fontSize: 14, margin: '20px 0 8px' }}>Tone of AI-drafted report comments</h3>
            <select aria-label="Report tone" value={answers.report_tone} onChange={(e) => update({ report_tone: e.target.value })} style={{ maxWidth: 320 }}>
              {Object.entries(TONES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </>
        )}

        {step === 7 && (
          <dl className="setup-review">
            <div><dt>School</dt><dd>{answers.school.name}{answers.school.motto && ` · "${answers.school.motto}"`}</dd></div>
            <div><dt>Education system</dt><dd>{system?.name}</dd></div>
            <div><dt>Year groups and classes</dt><dd>{answers.year_groups.map((g) => `${g.name} (${g.classes.join(', ')})`).join('; ')}</dd></div>
            <div><dt>Subjects</dt><dd>{answers.subjects.join(', ')}</dd></div>
            <div><dt>Terms</dt><dd>{answers.terms.map((t) => `${t.name}: ${t.start_date} to ${t.end_date}`).join('; ')}</dd></div>
            <div><dt>Assessments</dt><dd>{(answers.assessments || []).length ? answers.assessments.map((a) => `${a.name} ${a.weight}%`).join(', ') : 'None: every mark counts equally'}</dd></div>
            <div><dt>Grading</dt><dd>{catalogue.scales.find((s) => s.key === answers.grading_scale)?.label}</dd></div>
            <div><dt>Report tone</dt><dd>{TONES[answers.report_tone]}</dd></div>
          </dl>
        )}

        <div className="form-actions setup-actions">
          {step > 0 && <button type="button" className="secondary" onClick={() => go(-1)} disabled={saving}>Back</button>}
          {step < STEPS.length - 1
            ? <button type="button" onClick={() => go(1)}>Continue</button>
            : <button type="button" onClick={finish} disabled={saving}>{saving ? 'Setting up…' : 'Finish setup'}</button>}
        </div>
      </div>
      <p className="text-muted setup-foot">Signed in as {me?.name} · Your answers are saved as you go.</p>
    </div>
  )
}

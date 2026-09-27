import { useEffect, useState } from 'react'
import { useVocab } from '../levels.js'
import { api, needsApproval } from '../api.js'
import ImportCard from './ImportCard.jsx'
import YearEndCard from './YearEndCard.jsx'
import { COUNTRIES } from '../countries.js'

// Same list as the backend's gradebook.levels.SCALE_LABELS.
const SCALES = [
  { key: 'cbc4', label: 'CBC: 4 levels (EE, ME, AE, BE)' },
  { key: 'cbc8', label: 'CBC junior/senior school: 8 levels (EE1 to BE2)' },
  { key: 'kcse', label: 'KCSE letter grades (A to E)' },
  { key: 'igcse', label: 'IGCSE letter grades (A* to G)' },
  { key: 'igcse9', label: 'GCSE/IGCSE numbers (9 to 1)' },
  { key: 'ib', label: 'IB grades (7 to 1)' },
  { key: 'american', label: 'American letter grades (A to F)' },
  { key: 'percent', label: 'Percentages only' },
]
const SYSTEMS = { cbc: 'CBC', 844: '8-4-4', british: 'British / Cambridge', ib: 'International Baccalaureate', american: 'American' }
// The school settings form, and what each field is called in the API.
const SCHOOL_FIELDS = ['name', 'motto', 'phone', 'email', 'address', 'country', 'report_tone', 'grading_scale', 'privacy_contact']
const TONES = [
  { key: 'formal', label: 'Formal' },
  { key: 'warm', label: 'Warm / encouraging' },
  { key: 'concise', label: 'Concise / direct' },
]

// Admins' changes apply straight away. A teacher's change is sent to an
// admin for approval instead (the API answers 202), and this screen says so.
export default function Setup({ me, onUserUpdated }) {
  const words = useVocab()
  const isAdmin = me?.role === 'admin'
  const [school, setSchool] = useState(null)
  const [details, setDetails] = useState(null)
  const [notice, setNotice] = useState('')
  const [subjects, setSubjects] = useState([])
  const [terms, setTerms] = useState([])
  const [yearGroups, setYearGroups] = useState([])
  const [classes, setClasses] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [subjectName, setSubjectName] = useState('')
  const [termName, setTermName] = useState('')
  const [termStart, setTermStart] = useState('')
  const [termEnd, setTermEnd] = useState('')
  const [yearGroupName, setYearGroupName] = useState('')
  const [className, setClassName] = useState('')
  const [classYearGroup, setClassYearGroup] = useState('')
  const [classHouse, setClassHouse] = useState('')

  async function loadAll() {
    setLoading(true)
    setError('')
    try {
      const [s, t, yg, cls, schools] = await Promise.all([
        api.subjects.list(),
        api.terms.list(),
        api.yearGroups.list(),
        api.schoolClasses.list(),
        api.schools.mine(),
      ])
      if (schools[0]) {
        setSchool(schools[0])
        setDetails(Object.fromEntries(SCHOOL_FIELDS.map((f) => [f, schools[0][f] || ''])))
      }
      setSubjects(s)
      setTerms(t)
      setYearGroups(yg)
      setClasses(cls)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // Runs a create/update/delete and reports whether it was applied or sent
  // for approval. Returns true when the caller should clear its form.
  async function change(action, doneMessage) {
    setError('')
    setNotice('')
    try {
      const result = await action()
      setNotice(
        needsApproval(result)
          ? 'Sent to an admin for approval. You can follow it under My requests.'
          : doneMessage
      )
      loadAll()
      return true
    } catch (err) {
      setError(err.message)
      return false
    }
  }

  function remove(apiGroup, item, what) {
    const warning = isAdmin
      ? `Delete ${what} "${item.name}"? This can't be undone.`
      : `Ask an admin to delete ${what} "${item.name}"?`
    if (!window.confirm(warning)) return
    change(() => apiGroup.remove(item.id), `Deleted ${what} "${item.name}".`)
  }

  function schoolChanges() {
    if (!school || !details) return {}
    return Object.fromEntries(SCHOOL_FIELDS
      .map((f) => [f, typeof details[f] === 'string' ? details[f].trim() : details[f]])
      .filter(([f, v]) => v !== (school[f] || '') && !(f === 'name' && !v)))
  }

  async function saveSchool(e) {
    e.preventDefault()
    if (!school) return
    const body = schoolChanges()
    if (Object.keys(body).length === 0) return
    const ok = await change(() => api.schools.update(school.id, body), 'School settings saved.')
    // Levels are shown everywhere from the signed-in user's school, so refresh it.
    if (ok && isAdmin && (body.grading_scale || body.country)) api.me().then((fresh) => onUserUpdated?.(fresh)).catch(() => {})
  }

  async function addSubject(e) {
    e.preventDefault()
    if (!subjectName.trim()) return
    if (await change(() => api.subjects.create({ name: subjectName.trim() }), `${words.subject} added.`)) setSubjectName('')
  }

  async function addTerm(e) {
    e.preventDefault()
    if (!termName.trim() || !termStart || !termEnd) return
    const ok = await change(
      () => api.terms.create({ name: termName.trim(), start_date: termStart, end_date: termEnd }),
      'Term added.'
    )
    if (ok) {
      setTermName('')
      setTermStart('')
      setTermEnd('')
    }
  }

  async function addYearGroup(e) {
    e.preventDefault()
    if (!yearGroupName.trim()) return
    if (await change(() => api.yearGroups.create({ name: yearGroupName.trim() }), `${words.year_group} added.`)) {
      setYearGroupName('')
    }
  }

  async function addClass(e) {
    e.preventDefault()
    if (!className.trim() || !classYearGroup) return
    const ok = await change(
      () =>
        api.schoolClasses.create({
          name: className.trim(),
          year_group: Number(classYearGroup),
          house: classHouse.trim(),
        }),
      'Class added.'
    )
    if (ok) {
      setClassName('')
      setClassHouse('')
    }
  }


  const yearGroupName_ = (id) => yearGroups.find((yg) => yg.id === id)?.name || `#${id}`

  return (
    <div>
      <div className="panel-header">
        <h2>Setup</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="success-banner">{notice}</div>}
      {!isAdmin && (
        <p className="hint" style={{ marginTop: 0 }}>
          Changes you make here are sent to an admin for approval before they take effect.
        </p>
      )}

      {isAdmin && <ImportCard onImported={loadAll} />}

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>School settings</h3>
        {school?.education_system && (
          <p className="text-muted" style={{ marginTop: -6 }}>Education system: <strong>{SYSTEMS[school.education_system]}</strong></p>
        )}
        {details && (
          <form onSubmit={saveSchool}>
            <div className="form-row">
              {[['name', 'School name'], ['motto', 'Motto'], ['phone', 'Phone'], ['email', 'School email']].map(([key, label]) => (
                <div className="field" key={key}>
                  <label htmlFor={`school-${key}`}>{label}</label>
                  <input id={`school-${key}`} type={key === 'email' ? 'email' : 'text'} value={details[key]}
                    onChange={(e) => setDetails({ ...details, [key]: e.target.value })} />
                </div>
              ))}
            </div>
            <div className="field">
              <label htmlFor="school-country">Country</label>
              <select id="school-country" value={details.country} onChange={(e) => setDetails({ ...details, country: e.target.value })}>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="school-address">Address</label>
              <textarea id="school-address" rows={2} value={details.address} onChange={(e) => setDetails({ ...details, address: e.target.value })} />
            </div>
            <div className="form-row">
              <div className="field">
                <label htmlFor="school-tone">Report tone</label>
                <select id="school-tone" value={details.report_tone} onChange={(e) => setDetails({ ...details, report_tone: e.target.value })}>
                  {TONES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="school-scale">Grades and levels</label>
                <select id="school-scale" value={details.grading_scale} onChange={(e) => setDetails({ ...details, grading_scale: e.target.value })}>
                  {SCALES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="school-privacy">Privacy contact</label>
                <input id="school-privacy" value={details.privacy_contact} maxLength={255} placeholder="e.g. privacy@yourschool.org"
                  onChange={(e) => setDetails({ ...details, privacy_contact: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={Object.keys(schoolChanges()).length === 0}>
              {isAdmin ? 'Save settings' : 'Ask for approval'}
            </button>
          </form>
        )}
        <p className="hint">
          The motto, address, phone and email appear on report cards. The report tone is how AI-written report comments
          are phrased. The grade or level is shown next to percentages on grades, reports, report cards and charts (for
          example the CBC 4-level scale is EE 80–100%, ME 50–79%, AE 30–49% and BE 0–29%). The privacy contact is
          who parents and staff are told to contact about their personal data, in the privacy notice they accept when
          they create their account.
        </p>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>{words.subjects}</h3>
        <form onSubmit={addSubject} className="form-row" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="subject-name">New subject</label>
            <input
              id="subject-name"
              value={subjectName}
              onChange={(e) => setSubjectName(e.target.value)}
              placeholder="e.g. Mathematics"
            />
          </div>
          <button type="submit">{isAdmin ? 'Add subject' : 'Ask to add subject'}</button>
        </form>
        {!loading && subjects.length === 0 && (
          <p className="hint">No subjects yet — add one above before recording grades.</p>
        )}
        {subjects.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {subjects.map((s) => (
              <li key={s.id} style={{ marginBottom: 4 }}>
                {s.name}{' '}
                <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: '0 6px' }} onClick={() => remove(api.subjects, s, 'subject')}>
                  {isAdmin ? 'Delete' : 'Request delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>{words.terms}</h3>
        <form onSubmit={addTerm} className="form-row" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="term-name">{words.term} name</label>
            <input
              id="term-name"
              value={termName}
              onChange={(e) => setTermName(e.target.value)}
              placeholder="e.g. Term 1 2026"
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="term-start">Start date</label>
            <input id="term-start" type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="term-end">End date</label>
            <input id="term-end" type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
          </div>
          <button type="submit">{isAdmin ? 'Add term' : 'Ask to add term'}</button>
        </form>
        {!loading && terms.length === 0 && (
          <p className="hint">No terms yet — add one above before recording grades or generating reports.</p>
        )}
        {terms.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.start_date}</td>
                  <td>{t.end_date}</td>
                  <td>
                    <span className={`badge ${t.is_locked ? 'cancelled' : 'active'}`}>{t.is_locked ? 'Locked' : 'Open'}</span>
                  </td>
                  <td style={{ display: 'flex', gap: 8 }}>
                    {isAdmin && (
                      <button
                        className="secondary"
                        onClick={() => {
                          if (!t.is_locked && !window.confirm(`Lock ${t.name}? Nobody, including admins, can change its grades, reports or attendance until it's unlocked.`)) return
                          change(() => (t.is_locked ? api.terms.unlock(t.id) : api.terms.lock(t.id)), `${t.name} is ${t.is_locked ? 'unlocked' : 'locked'}.`)
                        }}
                      >
                        {t.is_locked ? 'Unlock' : 'Lock'}
                      </button>
                    )}
                    {!t.is_locked && (
                      <button className="danger" onClick={() => remove(api.terms, t, 'term')}>
                        {isAdmin ? 'Delete' : 'Request delete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>{words.year_groups}</h3>
        <form onSubmit={addYearGroup} className="form-row" style={{ marginBottom: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="yg-name">New year group</label>
            <input
              id="yg-name"
              value={yearGroupName}
              onChange={(e) => setYearGroupName(e.target.value)}
              placeholder="e.g. Year 7"
            />
          </div>
          <button type="submit">{isAdmin ? 'Add year group' : 'Ask to add year group'}</button>
        </form>
        {!loading && yearGroups.length === 0 && (
          <p className="hint">No year groups yet — add one above before creating classes.</p>
        )}
        {yearGroups.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {yearGroups.map((yg) => (
              <li key={yg.id} style={{ marginBottom: 4 }}>
                {yg.name}{' '}
                <button type="button" className="link-button" style={{ display: 'inline', width: 'auto', padding: '0 6px' }} onClick={() => remove(api.yearGroups, yg, 'year group')}>
                  {isAdmin ? 'Delete' : 'Request delete'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 14 }}>{words.classes}</h3>
        {yearGroups.length === 0 ? (
          <p className="hint" style={{ margin: 0 }}>
            Add a year group first, then classes can be created within it.
          </p>
        ) : (
          <>
            <form onSubmit={addClass} className="form-row" style={{ marginBottom: 16 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="class-year-group">{words.year_group}</label>
                <select
                  id="class-year-group"
                  value={classYearGroup}
                  onChange={(e) => setClassYearGroup(e.target.value)}
                >
                  <option value="">Select…</option>
                  {yearGroups.map((yg) => (
                    <option key={yg.id} value={yg.id}>
                      {yg.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="class-name">Class name</label>
                <input
                  id="class-name"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. 7A"
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor="class-house">House</label>
                <input
                  id="class-house"
                  value={classHouse}
                  onChange={(e) => setClassHouse(e.target.value)}
                  placeholder="optional"
                />
              </div>
              <button type="submit">{isAdmin ? 'Add class' : 'Ask to add class'}</button>
            </form>
            {classes.length === 0 ? (
              <p className="hint">No classes yet — add one above.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{words.class}</th>
                    <th>{words.year_group}</th>
                    <th>House</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {classes.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td>{yearGroupName_(c.year_group)}</td>
                      <td>{c.house || '—'}</td>
                      <td>
                        <button className="danger" onClick={() => remove(api.schoolClasses, c, 'class')}>
                          {isAdmin ? 'Delete' : 'Request delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
      {isAdmin && <YearEndCard classes={classes} onDone={loadAll} />}
    </div>
  )
}

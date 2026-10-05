import { useState } from 'react'

// One week of lessons: periods down the side, days across. On a phone it
// shows one day at a time. `show` decides what each lesson says besides
// the subject: the class (a teacher's or room's week), or the teacher.
export default function WeekGrid({ week, show = 'class', editable = false, onSlot, onLesson }) {
  const todayNumber = ((new Date().getDay() + 6) % 7) + 1
  const [day, setDay] = useState(week.days.some((d) => d.day === todayNumber) ? todayNumber : week.days[0]?.day)
  if (!week.periods.length) {
    return <p className="text-muted" style={{ margin: 0 }}>The school day hasn&apos;t been set up yet.</p>
  }
  const at = (d, p) => week.lessons.filter((l) => l.day === d && l.period === p)

  const detail = (l) => [show === 'class' ? l.class_name : l.teacher_name, l.room_name].filter(Boolean).join(' · ')
  const cell = (d, p) => (
    <>
      {at(d, p.id).map((l) => (
        <button key={l.id} type="button" className="tt-lesson" disabled={!editable}
          onClick={() => onLesson?.(l)} aria-label={`${l.label}${detail(l) ? `, ${detail(l)}` : ''}`}>
          <strong>{l.label}</strong>
          {detail(l) && <span>{detail(l)}</span>}
        </button>
      ))}
      {editable && (
        <button type="button" className="tt-add" onClick={() => onSlot?.(d, p)}
          aria-label={`Add a lesson on ${week.days.find((x) => x.day === d)?.name} ${p.name}`}>+</button>
      )}
    </>
  )
  const time = (p) => `${p.start_time}–${p.end_time}`

  return (
    <div className="tt">
      <div className="tt-wide">
        <table className="tt-table">
          <thead>
            <tr>
              <th scope="col"><span className="visually-hidden">Period</span></th>
              {week.days.map((d) => <th key={d.day} scope="col" className={d.day === todayNumber ? 'tt-today' : ''}>{d.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {week.periods.map((p) => (
              <tr key={p.id} className={p.is_break ? 'tt-break' : ''}>
                <th scope="row"><span>{p.name}</span><small>{time(p)}</small></th>
                {p.is_break
                  ? <td colSpan={week.days.length} />
                  : week.days.map((d) => <td key={d.day}>{cell(d.day, p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="tt-narrow">
        <div className="tt-days" role="tablist" aria-label="Day">
          {week.days.map((d) => (
            <button key={d.day} type="button" role="tab" aria-selected={day === d.day}
              className={day === d.day ? 'active-filter' : 'secondary'} onClick={() => setDay(d.day)}>
              {d.name.slice(0, 3)}
            </button>
          ))}
        </div>
        <ol className="tt-list">
          {week.periods.map((p) => (
            <li key={p.id} className={p.is_break ? 'tt-break' : ''}>
              <div className="tt-when"><span>{p.name}</span><small>{time(p)}</small></div>
              <div className="tt-what">
                {p.is_break ? null : (at(day, p.id).length || editable ? cell(day, p) : <span className="text-muted">Free</span>)}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

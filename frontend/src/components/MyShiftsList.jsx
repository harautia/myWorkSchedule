import { differenceInMinutes, format } from 'date-fns'
import { addDays, barDay, formatTime, isSameDay, weekStart } from '../utils/dates'
import { dayKey } from '../utils/lanes'

const formatHours = (start, end) => {
  const minutes = differenceInMinutes(end, start)
  return minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`
}

// The logged-in person's own shifts as a list, week by week: the quickest way
// to answer "when do I work?" on a phone. weekStarts are the Mondays shown;
// weeks are their statuses ({ 'yyyy-MM-dd': { status, published } }).
// Employees get published shifts only, so a week never locked says so.
const MyShiftsList = ({ weekStarts, weeks, shifts, employee, today, canEdit }) => (
  <div className="my-shifts">
    {weekStarts.map((monday) => {
      const key = dayKey(monday)
      const week = weeks[key]
      const weekShifts = shifts.filter((shift) => dayKey(weekStart(barDay(shift.start))) === key)
      const unpublished = !canEdit && week && !week.published

      return (
        <section key={key} className="my-shifts-week" aria-label={`Week ${format(monday, 'I')}`}>
          <h3 className="my-shifts-heading">
            Week {format(monday, 'I')}
            <span className="muted"> · {format(monday, 'd.M.')}–{format(addDays(monday, 6), 'd.M.')}</span>
            {canEdit && week?.status === 'planning' && <span className="status-badge is-planning">Planning</span>}
          </h3>
          {unpublished && <p className="page-note">Not published yet.</p>}
          {!unpublished && weekShifts.length === 0 && <p className="page-note">No shifts.</p>}
          {!unpublished && weekShifts.length > 0 && (
            <ul className="my-shifts-list">
              {weekShifts.map((shift) => {
                const day = barDay(shift.start)
                const classes = ['my-shift']
                if (isSameDay(day, today)) classes.push('is-today')
                else if (shift.end < today) classes.push('is-past')
                return (
                  <li key={shift.id} className={classes.join(' ')} style={{ '--shift-color': employee?.color }}>
                    <span className="my-shift-day">{format(day, 'EEE d.M.')}</span>
                    <span className="my-shift-time">{formatTime(shift.start)}–{formatTime(shift.end)}</span>
                    <span className="my-shift-hours muted">{formatHours(shift.start, shift.end)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )
    })}
  </div>
)

export default MyShiftsList

import { differenceInMinutes } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { addDays, barDay, formatDate, formatTime, isSameDay, weekStart } from '../utils/dates'
import { dayKey } from '../utils/lanes'

const formatHours = (t, start, end) => {
  const total = differenceInMinutes(end, start)
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  return minutes ? t('myShifts.hoursMinutes', { hours, minutes }) : t('myShifts.hours', { hours })
}

// The logged-in person's own shifts as a list, week by week: the quickest way
// to answer "when do I work?" on a phone. weekStarts are the Mondays shown;
// weeks are their statuses ({ 'yyyy-MM-dd': { status, published } }).
// Employees get published shifts only, so a week never locked says so.
const MyShiftsList = ({ weekStarts, weeks, shifts, employee, today, canEdit }) => {
  const { t } = useTranslation()
  return (
    <div className="my-shifts">
      {weekStarts.map((monday) => {
        const key = dayKey(monday)
        const week = weeks[key]
        const weekShifts = shifts.filter((shift) => dayKey(weekStart(barDay(shift.start))) === key)
        const unpublished = !canEdit && week && !week.published

        return (
          <section key={key} className="my-shifts-week" aria-label={t('myShifts.week', { number: formatDate(monday, 'I') })}>
            <h3 className="my-shifts-heading">
              {t('myShifts.week', { number: formatDate(monday, 'I') })}
              <span className="muted"> · {formatDate(monday, 'd.M.')}–{formatDate(addDays(monday, 6), 'd.M.')}</span>
              {canEdit && week?.status === 'planning' && <span className="status-badge is-planning">{t('myShifts.planning')}</span>}
            </h3>
            {unpublished && <p className="page-note">{t('myShifts.notPublished')}</p>}
            {!unpublished && weekShifts.length === 0 && <p className="page-note">{t('myShifts.noShifts')}</p>}
            {!unpublished && weekShifts.length > 0 && (
              <ul className="my-shifts-list">
                {weekShifts.map((shift) => {
                  const day = barDay(shift.start)
                  const classes = ['my-shift']
                  if (isSameDay(day, today)) classes.push('is-today')
                  else if (shift.end < today) classes.push('is-past')
                  return (
                    <li key={shift.id} className={classes.join(' ')} style={{ '--shift-color': employee?.color }}>
                      <span className="my-shift-day">{formatDate(day, 'EEE d.M.')}</span>
                      <span className="my-shift-time">{formatTime(shift.start)}–{formatTime(shift.end)}</span>
                      <span className="my-shift-hours muted">{formatHours(t, shift.start, shift.end)}</span>
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
}

export default MyShiftsList

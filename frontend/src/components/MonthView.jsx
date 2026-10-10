import { useTranslation } from 'react-i18next'
import { formatDate, formatShortTime, isSameDay, isSameMonth, weekdayNames, weekStart } from '../utils/dates'
import { dayKey, employeeOrder, shiftsOnDay } from '../utils/lanes'

const MAX_CHIPS = 3

const MonthView = ({
  days,
  currentDate,
  shifts,
  employeesById,
  today,
  dayOrders = {},
  lockedWeeks,
  onSelectDay
}) => {
  const { t } = useTranslation()
  return (
    <div className="month-grid">
      {weekdayNames().map((name) => (
        <div key={name} className="month-weekday">{name}</div>
      ))}
      {days.map((day) => {
        const dayShifts = shiftsOnDay(shifts, day)
        const order = employeeOrder(dayShifts, dayOrders[dayKey(day)])
        dayShifts.sort(
          (a, b) => order.indexOf(a.employeeId) - order.indexOf(b.employeeId) || a.start - b.start
        )
        const hidden = dayShifts.length - MAX_CHIPS
        const classes = ['month-day']
        if (!isSameMonth(day, currentDate)) classes.push('is-outside')
        if (isSameDay(day, today)) classes.push('is-today')
        // Managers: mark the days of locked weeks, with a lock on each Monday.
        const locked = lockedWeeks?.has(dayKey(weekStart(day)))
        if (locked) classes.push('is-locked')

        return (
          <div key={day.toISOString()} className={classes.join(' ')} data-testid="month-day">
            <button
              type="button"
              className="month-day-number"
              onClick={() => onSelectDay(day)}
              aria-label={t('month.showWeek', { date: formatDate(day, 'EEEE d.M.yyyy') })}
            >
              {day.getDate()}
            </button>
            {locked && day.getDay() === 1 && (
              <span className="month-lock" title={t('week.locked')}>🔒</span>
            )}
            <ul className="month-chips">
              {dayShifts.slice(0, MAX_CHIPS).map((shift) => {
                const employee = employeesById[shift.employeeId]
                return (
                  <li
                    key={shift.id}
                    className="month-chip"
                    style={{ '--shift-color': employee.color }}
                  >
                    {employee.name} {formatShortTime(shift.start)}–{formatShortTime(shift.end)}
                  </li>
                )
              })}
              {hidden > 0 && <li className="month-more">{t('month.more', { count: hidden })}</li>}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

export default MonthView

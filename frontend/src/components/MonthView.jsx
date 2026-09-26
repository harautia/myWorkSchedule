import { formatShortTime, isSameDay, isSameMonth } from '../utils/dates'
import { dayKey, employeeOrder, shiftsOnDay } from '../utils/lanes'

const MAX_CHIPS = 3
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const MonthView = ({
  days,
  currentDate,
  shifts,
  employeesById,
  today,
  dayOrders = {},
  onSelectDay
}) => (
  <div className="month-grid">
    {WEEKDAYS.map((name) => (
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

      return (
        <div key={day.toISOString()} className={classes.join(' ')} data-testid="month-day">
          <button
            type="button"
            className="month-day-number"
            onClick={() => onSelectDay(day)}
            aria-label={`Show week of ${day.toDateString()}`}
          >
            {day.getDate()}
          </button>
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
            {hidden > 0 && <li className="month-more">+{hidden} more</li>}
          </ul>
        </div>
      )
    })}
  </div>
)

export default MonthView

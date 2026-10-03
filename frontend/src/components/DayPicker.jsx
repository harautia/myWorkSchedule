import { useEffect, useState } from 'react'
import { addMonths, format } from 'date-fns'
import shiftService from '../services/shifts'
import { addDays, isSameMonth, monthGrid, weekStart } from '../utils/dates'
import { dayKey } from '../utils/lanes'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// A small month calendar for choosing several bar days. selected is a Set of
// 'yyyy-MM-dd' keys; clicking a day adds or removes it. Days in locked weeks
// can't be chosen.
const DayPicker = ({ selected, onToggle, initialMonth }) => {
  const [month, setMonth] = useState(initialMonth)
  const [weeks, setWeeks] = useState({})
  const days = monthGrid(month)
  const firstKey = dayKey(days[0])
  const endKey = dayKey(addDays(days[days.length - 1], 1))

  useEffect(() => {
    shiftService.getWeeks(firstKey, endKey).then(setWeeks).catch(() => setWeeks({}))
  }, [firstKey, endKey])

  const isLocked = (day) => weeks[dayKey(weekStart(day))]?.status === 'locked'

  return (
    <div className="day-picker">
      <div className="day-picker-header">
        <button type="button" className="btn btn-nav" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
          ‹
        </button>
        <span className="day-picker-month">{format(month, 'MMMM yyyy')}</span>
        <button type="button" className="btn btn-nav" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
          ›
        </button>
      </div>
      <div className="day-picker-grid" role="group" aria-label="Bar days">
        {WEEKDAYS.map((name) => (
          <span key={name} className="day-picker-weekday">{name}</span>
        ))}
        {days.map((day) => {
          const key = dayKey(day)
          const locked = isLocked(day)
          const classes = ['day-picker-day']
          if (!isSameMonth(day, month)) classes.push('is-outside')
          if (selected.has(key)) classes.push('is-selected')
          return (
            <button
              key={key}
              type="button"
              className={classes.join(' ')}
              aria-pressed={selected.has(key)}
              aria-label={`${format(day, 'EEEE d.M.yyyy')}${locked ? ' (week locked)' : ''}`}
              title={locked ? 'Week locked' : undefined}
              disabled={locked}
              onClick={() => onToggle(key)}
            >
              {day.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default DayPicker

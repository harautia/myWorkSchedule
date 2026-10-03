import { format } from 'date-fns'
import { isSameDay } from '../utils/dates'

// Phones: the week's days as buttons; the chosen one is shown below.
const DayStrip = ({ days, selected, today, onSelect }) => (
  <div className="day-strip" role="group" aria-label="Day">
    {days.map((day) => {
      const classes = ['day-strip-day']
      if (isSameDay(day, today)) classes.push('is-today')
      return (
        <button
          key={day.toISOString()}
          type="button"
          className={classes.join(' ')}
          aria-pressed={isSameDay(day, selected)}
          aria-label={format(day, 'EEEE d.M.')}
          onClick={() => onSelect(day)}
        >
          <span className="day-strip-weekday">{format(day, 'EEE')}</span>
          <span className="day-strip-date">{day.getDate()}</span>
        </button>
      )
    })}
  </div>
)

export default DayStrip

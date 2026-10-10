import { useTranslation } from 'react-i18next'
import { formatDate, isSameDay } from '../utils/dates'

// Phones: the week's days as buttons; the chosen one is shown below.
const DayStrip = ({ days, selected, today, onSelect }) => {
  const { t } = useTranslation()
  return (
    <div className="day-strip" role="group" aria-label={t('dayStrip.label')}>
      {days.map((day) => {
        const classes = ['day-strip-day']
        if (isSameDay(day, today)) classes.push('is-today')
        return (
          <button
            key={day.toISOString()}
            type="button"
            className={classes.join(' ')}
            aria-pressed={isSameDay(day, selected)}
            aria-label={formatDate(day, 'EEEE d.M.')}
            onClick={() => onSelect(day)}
          >
            <span className="day-strip-weekday">{formatDate(day, 'EEE')}</span>
            <span className="day-strip-date">{day.getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}

export default DayStrip

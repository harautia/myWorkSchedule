import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { timeNowIn, timezoneGroups } from '../utils/forms'

// The bar's timezone: every IANA zone grouped by region, with the time there
// now to confirm the choice.
const TimezoneSelect = ({ value, onChange }) => {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="form-field">
      <label htmlFor={id}>{t('barSettings.timezone')}</label>
      {/* A real list: a text field with suggestions only offers zones matching
          what is already typed, so another zone couldn't be found. */}
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={`${id}-now`} required>
        {timezoneGroups(value).map(([region, zones]) => (
          <optgroup key={region} label={region}>
            {zones.map((zone) => (
              <option key={zone} value={zone}>{zone.replaceAll('_', ' ')}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {timeNowIn(value) && (
        <span id={`${id}-now`} className="field-hint">
          {t('barSettings.timeNow', { time: timeNowIn(value) })}
        </span>
      )}
    </div>
  )
}

export default TimezoneSelect

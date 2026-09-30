import { TIMEZONES } from '../../utils/forms'

// Controlled inputs for bar settings. value = { name, timezone, opensAt, closesAt }
const BarFields = ({ value, onChange }) => {
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value })
  return (
    <div className="form-grid">
      <label className="form-field">
        Bar name
        <input value={value.name} onChange={set('name')} maxLength={100} required />
      </label>
      <label className="form-field">
        Timezone
        <input value={value.timezone} onChange={set('timezone')} list="timezones" required />
        <datalist id="timezones">
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </label>
      <label className="form-field">
        Opens
        <input type="time" value={value.opensAt} onChange={set('opensAt')} required />
      </label>
      <label className="form-field">
        Closes
        <input type="time" value={value.closesAt} onChange={set('closesAt')} required />
      </label>
    </div>
  )
}

export default BarFields

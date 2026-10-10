import { LANGUAGES, TIMEZONES } from '../../utils/forms'

// Controlled inputs for a bar's settings. value = { name, timezone, opensAt,
// closesAt, locale, clock24h, accentColor }
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
      <label className="form-field">
        Language
        <select value={value.locale} onChange={set('locale')}>
          {LANGUAGES.map(({ code, label }) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </label>
      <label className="form-field">
        Clock
        <select
          value={value.clock24h ? '24' : '12'}
          onChange={(event) => onChange({ ...value, clock24h: event.target.value === '24' })}
        >
          <option value="24">24-hour (18:30)</option>
          <option value="12">12-hour (6:30 PM)</option>
        </select>
      </label>
      <label className="form-field">
        Accent colour
        <span className="input-with-button">
          <input type="color" value={value.accentColor} onChange={set('accentColor')} className="color-input" />
          <span className="accent-preview" style={{ '--accent': value.accentColor }}>Button</span>
        </span>
      </label>
      <p className="field-hint form-grid-full">
        Times are shown in the bar&apos;s timezone for everyone. When the bar closes after midnight,
        shifts after midnight belong to the evening before. Pick a fairly dark accent colour:
        buttons show white text on it.
      </p>
    </div>
  )
}

export default BarFields

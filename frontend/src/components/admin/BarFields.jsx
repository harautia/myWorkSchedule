import { useTranslation } from 'react-i18next'
import { LANGUAGES, TIMEZONES } from '../../utils/forms'

// Controlled inputs for a bar's settings. value = { name, timezone, opensAt,
// closesAt, locale, clock24h, accentColor }
const BarFields = ({ value, onChange }) => {
  const { t } = useTranslation()
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value })
  return (
    <div className="form-grid">
      <label className="form-field">
        {t('barSettings.name')}
        <input value={value.name} onChange={set('name')} maxLength={100} required />
      </label>
      <label className="form-field">
        {t('barSettings.timezone')}
        <input value={value.timezone} onChange={set('timezone')} list="timezones" required />
        <datalist id="timezones">
          {TIMEZONES.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
      </label>
      <label className="form-field">
        {t('barSettings.opens')}
        <input type="time" value={value.opensAt} onChange={set('opensAt')} required />
      </label>
      <label className="form-field">
        {t('barSettings.closes')}
        <input type="time" value={value.closesAt} onChange={set('closesAt')} required />
      </label>
      <label className="form-field">
        {t('barSettings.language')}
        <select value={value.locale} onChange={set('locale')}>
          {LANGUAGES.map(({ code, label }) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>
      </label>
      <label className="form-field">
        {t('barSettings.clock')}
        <select
          value={value.clock24h ? '24' : '12'}
          onChange={(event) => onChange({ ...value, clock24h: event.target.value === '24' })}
        >
          <option value="24">{t('barSettings.clock24')}</option>
          <option value="12">{t('barSettings.clock12')}</option>
        </select>
      </label>
      <label className="form-field">
        {t('barSettings.accent')}
        <span className="input-with-button">
          <input type="color" value={value.accentColor} onChange={set('accentColor')} className="color-input" />
          <span className="accent-preview" style={{ '--accent': value.accentColor }}>{t('barSettings.accentPreview')}</span>
        </span>
      </label>
      <p className="field-hint form-grid-full">
        {t('barSettings.hint')}
      </p>
    </div>
  )
}

export default BarFields

import { useTranslation } from 'react-i18next'
import PasswordField from './PasswordField'

// Controlled inputs for a new login account. value = { username, name, password, email }
const AccountFields = ({ value, onChange, nameLabel, hint }) => {
  const { t } = useTranslation()
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value })
  return (
    <div className="form-grid">
      <label className="form-field">
        {nameLabel ?? t('account.name')}
        <input value={value.name} onChange={set('name')} maxLength={100} required />
      </label>
      <label className="form-field">
        {t('account.username')}
        <input
          value={value.username}
          onChange={set('username')}
          pattern="[A-Za-z0-9._\-]{3,32}"
          title={t('account.usernameRule')}
          autoComplete="off"
          required
        />
      </label>
      <label className="form-field">
        {t('account.emailOptional')}
        <input type="email" value={value.email ?? ''} onChange={set('email')} autoComplete="off" />
      </label>
      <PasswordField value={value.password} onChange={(password) => onChange({ ...value, password })} />
      {hint && <p className="field-hint form-grid-full">{hint}</p>}
    </div>
  )
}

export default AccountFields

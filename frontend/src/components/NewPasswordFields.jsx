import { useTranslation } from 'react-i18next'
import { MIN_PASSWORD_LENGTH } from '../utils/forms'

// Choosing one's own password: typed twice. value = { password, repeat }
const NewPasswordFields = ({ value, onChange }) => {
  const { t } = useTranslation()
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value })
  return (
    <>
      <label className="form-field">
        {t('links.newPassword')}
        <input
          type="password"
          value={value.password}
          onChange={set('password')}
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          autoFocus
          required
        />
      </label>
      <label className="form-field">
        {t('links.repeatPassword')}
        <input
          type="password"
          value={value.repeat}
          onChange={set('repeat')}
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          required
        />
      </label>
      <p className="field-hint">{t('account.minLength', { count: MIN_PASSWORD_LENGTH })}</p>
    </>
  )
}

export default NewPasswordFields

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { generatePassword, MIN_PASSWORD_LENGTH } from '../utils/forms'

// Shown as plain text so it can be copied and handed to the person.
const PasswordField = ({ label, value, onChange }) => {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div className="form-field">
      <label htmlFor={id}>{label ?? t('account.password')}</label>
      <span className="input-with-button">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          spellCheck={false}
          aria-describedby={`${id}-hint`}
          required
        />
        <button type="button" className="btn btn-nav" onClick={() => onChange(generatePassword())}>
          {t('account.generate')}
        </button>
      </span>
      <span id={`${id}-hint`} className="field-hint">
        {t('account.passwordHint', { count: MIN_PASSWORD_LENGTH })}
      </span>
    </div>
  )
}

export default PasswordField

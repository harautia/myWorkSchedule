import { useId } from 'react'
import { generatePassword, MIN_PASSWORD_LENGTH } from '../utils/forms'

// Shown as plain text so it can be copied and handed to the person.
const PasswordField = ({ label = 'Password', value, onChange }) => {
  const id = useId()
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
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
          Generate
        </button>
      </span>
      <span id={`${id}-hint`} className="field-hint">
        At least {MIN_PASSWORD_LENGTH} characters. Give it to the person securely.
      </span>
    </div>
  )
}

export default PasswordField

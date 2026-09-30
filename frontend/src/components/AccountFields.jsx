import PasswordField from './PasswordField'

// Controlled inputs for a new login account. value = { username, name, password }
const AccountFields = ({ value, onChange, nameLabel = 'Name', hint }) => {
  const set = (field) => (event) => onChange({ ...value, [field]: event.target.value })
  return (
    <div className="form-grid">
      <label className="form-field">
        {nameLabel}
        <input value={value.name} onChange={set('name')} maxLength={100} required />
      </label>
      <label className="form-field">
        Username
        <input
          value={value.username}
          onChange={set('username')}
          pattern="[A-Za-z0-9._\-]{3,32}"
          title="3-32 characters: letters, numbers, dot, dash or underscore"
          autoComplete="off"
          required
        />
      </label>
      <PasswordField value={value.password} onChange={(password) => onChange({ ...value, password })} />
      {hint && <p className="field-hint form-grid-full">{hint}</p>}
    </div>
  )
}

export default AccountFields

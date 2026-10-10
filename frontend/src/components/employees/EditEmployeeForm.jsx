import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PasswordField from '../PasswordField'
import employeeService from '../../services/employees'
import { errorMessage } from '../../utils/forms'

// Rename an employee, or change the email or password of their login account.
// A new password also logs the employee out of any open sessions.
const EditEmployeeForm = ({ employee, onSaved, onCancel }) => {
  const { t } = useTranslation()
  const [name, setName] = useState(employee.name)
  const [email, setEmail] = useState(employee.account?.email ?? '')
  const [changePassword, setChangePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const changes = {}
    if (name.trim() !== employee.name) changes.name = name.trim()
    if (employee.account && email.trim() !== (employee.account.email ?? '')) changes.email = email.trim()
    if (changePassword) changes.password = password
    if (!Object.keys(changes).length) return onCancel()

    setSaving(true)
    setError(null)
    try {
      await employeeService.update(employee.id, changes)
      onSaved(changes.password
        ? t('employees.passwordSet', { username: employee.account.email ?? employee.account.username })
        : t('employees.saved', { name: name.trim() }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} aria-label={t('employees.editLabel', { name: employee.name })}>
      <div className="form-grid">
        <label className="form-field">
          {t('account.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </label>
        {employee.account && (
          <label className="form-field">
            {t('employees.email')}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
              required={!employee.account.username}
            />
          </label>
        )}
        {employee.account && (changePassword ? (
          <PasswordField label={t('account.newPassword')} value={password} onChange={setPassword} />
        ) : (
          <div className="form-field">
            {t('account.password')}
            <button type="button" className="btn btn-nav" onClick={() => setChangePassword(true)}>
              {t('account.setNewPassword')}
            </button>
          </div>
        ))}
      </div>
      {changePassword && (
        <p className="field-hint">{t('employees.logoutWarning', { name: employee.name })}</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

export default EditEmployeeForm

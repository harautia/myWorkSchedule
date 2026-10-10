import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import employeeService from '../../services/employees'
import { errorMessage } from '../../utils/forms'

// Adds a person to the schedule and invites them by email to set up their own
// login. onSaved(employee) gets the new employee with inviteSent.
const AddEmployeeForm = ({ onSaved, onCancel }) => {
  const { t } = useTranslation()
  const [person, setPerson] = useState({ name: '', email: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (field) => (event) => setPerson({ ...person, [field]: event.target.value })

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      onSaved(await employeeService.create(person))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label={t('employees.add')}>
      <h3 className="card-title">{t('employees.add')}</h3>
      <div className="form-grid">
        <label className="form-field">
          {t('employees.nameLabel')}
          <input value={person.name} onChange={set('name')} maxLength={100} required />
        </label>
        <label className="form-field">
          {t('employees.email')}
          <input type="email" value={person.email} onChange={set('email')} autoComplete="off" required />
        </label>
        <p className="field-hint form-grid-full">{t('employees.addHint')}</p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('employees.adding') : t('employees.addAndInvite')}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

export default AddEmployeeForm

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountFields from '../AccountFields'
import employeeService from '../../services/employees'
import { EMPTY_ACCOUNT, errorMessage } from '../../utils/forms'

const AddEmployeeForm = ({ onSaved, onCancel }) => {
  const { t } = useTranslation()
  const [account, setAccount] = useState(EMPTY_ACCOUNT)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await employeeService.create(account)
      onSaved(t('employees.added', { name: created.name, username: created.account.username }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label={t('employees.add')}>
      <h3 className="card-title">{t('employees.add')}</h3>
      <AccountFields
        value={account}
        onChange={setAccount}
        nameLabel={t('employees.nameLabel')}
        hint={t('employees.addHint')}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('employees.adding') : t('employees.add')}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

export default AddEmployeeForm

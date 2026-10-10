import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import AccountFields from '../AccountFields'
import adminService from '../../services/admin'
import { EMPTY_ACCOUNT, errorMessage } from '../../utils/forms'

const AddManagerForm = ({ barId, onSaved, onCancel }) => {
  const { t } = useTranslation()
  const [manager, setManager] = useState(EMPTY_ACCOUNT)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await adminService.addManager(barId, manager)
      onSaved(t('admin.managerAdded', { username: created.username }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label={t('admin.addManager')}>
      <h3 className="card-title">{t('admin.addManager')}</h3>
      <AccountFields value={manager} onChange={setManager} nameLabel={t('admin.managerName')} hint={t('admin.managerHint')} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('employees.adding') : t('admin.addManager')}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

export default AddManagerForm

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import BarFields from './BarFields'
import AccountFields from '../AccountFields'
import adminService from '../../services/admin'
import { EMPTY_BAR, EMPTY_ACCOUNT, errorMessage } from '../../utils/forms'

// Creates a bar together with its first manager.
const NewBarForm = ({ onCreated, onCancel }) => {
  const { t } = useTranslation()
  const [bar, setBar] = useState(EMPTY_BAR)
  const [manager, setManager] = useState(EMPTY_ACCOUNT)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const details = await adminService.createBar(bar, manager)
      onCreated(details.bar.id)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <section>
      <button type="button" className="link-button back-link" onClick={onCancel}>
        {t('admin.allBars')}
      </button>
      <h2 className="page-title">{t('admin.newBar')}</h2>
      <form className="card" onSubmit={handleSubmit}>
        <h3 className="card-title">{t('admin.barSection')}</h3>
        <BarFields value={bar} onChange={setBar} />
        <h3 className="card-title">{t('admin.firstManager')}</h3>
        <AccountFields value={manager} onChange={setManager} nameLabel={t('admin.managerName')} hint={t('admin.managerHint')} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('admin.creating') : t('admin.create')}
          </button>
          <button type="button" className="btn btn-nav" onClick={onCancel}>
            {t('common.cancel')}
          </button>
        </div>
      </form>
    </section>
  )
}

export default NewBarForm

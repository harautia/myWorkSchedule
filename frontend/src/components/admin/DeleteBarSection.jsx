import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Deleting a bar removes everything in it and can't be undone, so the admin
// has to type the bar's name to confirm.
const DeleteBarSection = ({ bar, onDeleted }) => {
  const { t } = useTranslation()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const confirmed = confirmation.trim() === bar.name

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!confirmed) return
    setDeleting(true)
    setError(null)
    try {
      await adminService.deleteBar(bar.id)
      onDeleted(t('admin.deleted', { name: bar.name }))
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <form className="card danger-zone" onSubmit={handleSubmit} aria-label={t('admin.deleteTitle')}>
      <h3 className="card-title">{t('admin.deleteTitle')}</h3>
      <p className="field-hint">
        {t('admin.deleteWarning', { name: bar.name })}
      </p>
      <label className="form-field">
        {t('admin.deleteConfirmLabel')}
        <input
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={bar.name}
          autoComplete="off"
        />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-danger" disabled={!confirmed || deleting}>
          {deleting ? t('admin.deleting') : t('admin.deleteButton')}
        </button>
      </div>
    </form>
  )
}

export default DeleteBarSection

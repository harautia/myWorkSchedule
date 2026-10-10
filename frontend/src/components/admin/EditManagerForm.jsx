import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PasswordField from '../PasswordField'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Rename a manager, or set a new password (password recovery). A new
// password also logs the manager out of any open sessions.
const EditManagerForm = ({ barId, manager, onSaved, onCancel }) => {
  const { t } = useTranslation()
  const [name, setName] = useState(manager.name)
  const [changePassword, setChangePassword] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    const changes = {}
    if (name.trim() !== manager.name) changes.name = name.trim()
    if (changePassword) changes.password = password
    if (!Object.keys(changes).length) return onCancel()

    setSaving(true)
    setError(null)
    try {
      await adminService.updateManager(barId, manager.id, changes)
      onSaved(changes.password ? t('admin.passwordSet', { username: manager.username }) : t('admin.saved', { username: manager.username }))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} aria-label={t('admin.editLabel', { username: manager.username })}>
      <div className="form-grid">
        <label className="form-field">
          {t('account.name')}
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </label>
        {changePassword ? (
          <PasswordField label={t('account.newPassword')} value={password} onChange={setPassword} />
        ) : (
          <div className="form-field">
            {t('account.password')}
            <button type="button" className="btn btn-nav" onClick={() => setChangePassword(true)}>
              {t('account.setNewPassword')}
            </button>
          </div>
        )}
      </div>
      {changePassword && (
        <p className="field-hint">{t('employees.logoutWarning', { name: manager.name })}</p>
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

export default EditManagerForm

import { useState } from 'react'
import PasswordField from '../PasswordField'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Rename a manager, or set a new password (password recovery). A new
// password also logs the manager out of any open sessions.
const EditManagerForm = ({ barId, manager, onSaved, onCancel }) => {
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
      onSaved(changes.password ? `New password set for ${manager.username}` : `Saved ${manager.username}`)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit} aria-label={`Edit ${manager.username}`}>
      <div className="form-grid">
        <label className="form-field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
        </label>
        {changePassword ? (
          <PasswordField label="New password" value={password} onChange={setPassword} />
        ) : (
          <div className="form-field">
            Password
            <button type="button" className="btn btn-nav" onClick={() => setChangePassword(true)}>
              Set new password
            </button>
          </div>
        )}
      </div>
      {changePassword && (
        <p className="field-hint">Saving a new password logs {manager.name} out on all devices.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default EditManagerForm

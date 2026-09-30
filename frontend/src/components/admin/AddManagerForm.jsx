import { useState } from 'react'
import AccountFields from '../AccountFields'
import adminService from '../../services/admin'
import { EMPTY_ACCOUNT, MANAGER_HINT, errorMessage } from '../../utils/forms'

const AddManagerForm = ({ barId, onSaved, onCancel }) => {
  const [manager, setManager] = useState(EMPTY_ACCOUNT)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await adminService.addManager(barId, manager)
      onSaved(`Added manager ${created.username}`)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label="Add manager">
      <h3 className="card-title">Add manager</h3>
      <AccountFields value={manager} onChange={setManager} nameLabel="Manager's name" hint={MANAGER_HINT} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add manager'}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default AddManagerForm

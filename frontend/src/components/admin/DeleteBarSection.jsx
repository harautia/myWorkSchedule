import { useState } from 'react'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Deleting a bar removes everything in it and can't be undone, so the admin
// has to type the bar's name to confirm.
const DeleteBarSection = ({ bar, onDeleted }) => {
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
      onDeleted(`Deleted ${bar.name}`)
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <form className="card danger-zone" onSubmit={handleSubmit} aria-label="Delete bar">
      <h3 className="card-title">Delete bar</h3>
      <p className="field-hint">
        Permanently deletes {bar.name} with all its employees, shifts and user accounts. This cannot be undone.
      </p>
      <label className="form-field">
        Type the bar name to confirm
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
          {deleting ? 'Deleting…' : 'Delete bar permanently'}
        </button>
      </div>
    </form>
  )
}

export default DeleteBarSection

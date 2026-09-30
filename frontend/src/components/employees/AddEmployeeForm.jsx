import { useState } from 'react'
import AccountFields from '../AccountFields'
import employeeService from '../../services/employees'
import { EMPTY_ACCOUNT, errorMessage } from '../../utils/forms'

const AddEmployeeForm = ({ onSaved, onCancel }) => {
  const [account, setAccount] = useState(EMPTY_ACCOUNT)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const created = await employeeService.create(account)
      onSaved(`Added ${created.name} (${created.account.username})`)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label="Add employee">
      <h3 className="card-title">Add employee</h3>
      <AccountFields
        value={account}
        onChange={setAccount}
        nameLabel="Employee's name"
        hint="The employee is added to the schedule as a waiter and can log in to see it."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Adding…' : 'Add employee'}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default AddEmployeeForm

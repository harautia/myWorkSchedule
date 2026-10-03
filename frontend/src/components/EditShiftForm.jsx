import { useState } from 'react'
import { format } from 'date-fns'
import { barDay, formatTime, SNAP_MINUTES, timeOnBarDay } from '../utils/dates'
import { errorMessage } from '../utils/forms'

// Touch screens: shifts can't be dragged there, so tapping one opens this
// form to change its employee and times on the same bar day, or delete it.
// onSave({ employeeId, start, end }) and onDelete() return promises.
const EditShiftForm = ({ shift, employees, onSave, onDelete, onCancel }) => {
  const day = barDay(shift.start)
  const [form, setForm] = useState({
    employeeId: String(shift.employeeId),
    start: formatTime(shift.start),
    end: formatTime(shift.end)
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  const run = async (action) => {
    setSaving(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    const start = timeOnBarDay(day, form.start)
    const end = timeOnBarDay(day, form.end)
    if (end <= start) {
      return setError('The shift must end after it starts (the bar day runs from opening to closing)')
    }
    run(() => onSave({ employeeId: Number(form.employeeId), start, end }))
  }

  return (
    <form className="card shift-sheet" onSubmit={handleSubmit} aria-label="Edit shift">
      <h3 className="card-title">Shift on {format(day, 'EEEE d.M.')}</h3>
      <div className="form-grid">
        <label className="form-field">
          Employee
          <select value={form.employeeId} onChange={set('employeeId')} required>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.role})
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Start
          <input type="time" value={form.start} onChange={set('start')} step={SNAP_MINUTES * 60} required />
        </label>
        <label className="form-field">
          End
          <input type="time" value={form.end} onChange={set('end')} step={SNAP_MINUTES * 60} required />
        </label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-danger form-actions-end" onClick={() => run(onDelete)} disabled={saving}>
          Delete
        </button>
      </div>
    </form>
  )
}

export default EditShiftForm

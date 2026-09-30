import { useState } from 'react'
import { addMinutes, parseISO } from 'date-fns'
import {
  barDayStart,
  formatTime,
  OPEN_MINUTES,
  SNAP_MINUTES,
  timeOnBarDay
} from '../utils/dates'
import { dayKey } from '../utils/lanes'
import { errorMessage } from '../utils/forms'

const DEFAULT_SHIFT_MINUTES = 8 * 60

// Managers: plan a new shift. Opened by clicking an empty spot in the week
// view (day and startMinutes = minutes from opening), or by "Add shift".
// onSave({ employeeId, start, end }) returns a promise.
const NewShiftForm = ({ employees, day, startMinutes, onSave, onCancel }) => {
  const opening = barDayStart(day)
  const [form, setForm] = useState({
    employeeId: '',
    date: dayKey(day),
    start: formatTime(addMinutes(opening, startMinutes)),
    end: formatTime(addMinutes(opening, Math.min(startMinutes + DEFAULT_SHIFT_MINUTES, OPEN_MINUTES)))
  })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  const handleSubmit = async (event) => {
    event.preventDefault()
    const shiftDay = parseISO(form.date)
    const start = timeOnBarDay(shiftDay, form.start)
    const end = timeOnBarDay(shiftDay, form.end)
    if (end <= start) {
      return setError('The shift must end after it starts (the bar day runs from opening to closing)')
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({ employeeId: Number(form.employeeId), start, end })
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit} aria-label="New shift">
      <h3 className="card-title">New shift</h3>
      <div className="form-grid">
        <label className="form-field">
          Employee
          <select value={form.employeeId} onChange={set('employeeId')} required autoFocus>
            <option value="" disabled>Choose…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.role})
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Bar day
          <input type="date" value={form.date} onChange={set('date')} required />
        </label>
        <label className="form-field">
          Start
          <input type="time" value={form.start} onChange={set('start')} step={SNAP_MINUTES * 60} required />
        </label>
        <label className="form-field">
          End
          <input type="time" value={form.end} onChange={set('end')} step={SNAP_MINUTES * 60} required />
        </label>
        <p className="field-hint form-grid-full">
          Times after midnight belong to the evening before: a Friday shift 20:00–02:00 ends at 02:00 on Saturday.
        </p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Add shift'}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default NewShiftForm

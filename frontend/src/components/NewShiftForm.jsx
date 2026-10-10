import { useState } from 'react'
import { addMinutes, format } from 'date-fns'
import DayPicker from './DayPicker'
import {
  barDayStart,
  formatTime,
  fromDayKey,
  openMinutes,
  SNAP_MINUTES,
  timeOnBarDay
} from '../utils/dates'
import { dayKey } from '../utils/lanes'
import { errorMessage } from '../utils/forms'

const DEFAULT_SHIFT_MINUTES = 8 * 60

// Managers: plan the same shift for one employee on one or more bar days.
// Opened by clicking an empty spot in the week view (day and startMinutes =
// minutes from opening), or by "Add shift"; that day is chosen to start with.
// onSave([{ employeeId, start, end }, ...]) returns a promise.
const NewShiftForm = ({ employees, day, startMinutes, onSave, onCancel }) => {
  const opening = barDayStart(day)
  const [form, setForm] = useState({
    employeeId: '',
    start: formatTime(addMinutes(opening, startMinutes)),
    end: formatTime(addMinutes(opening, Math.min(startMinutes + DEFAULT_SHIFT_MINUTES, openMinutes())))
  })
  const [days, setDays] = useState(() => new Set([dayKey(day)]))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value })

  const toggleDay = (key) => {
    setDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const chosenDays = [...days].sort().map(fromDayKey)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!chosenDays.length) return setError('Choose at least one bar day')
    const shifts = chosenDays.map((shiftDay) => ({
      employeeId: Number(form.employeeId),
      start: timeOnBarDay(shiftDay, form.start),
      end: timeOnBarDay(shiftDay, form.end)
    }))
    if (shifts[0].end <= shifts[0].start) {
      return setError('The shift must end after it starts (the bar day runs from opening to closing)')
    }

    setSaving(true)
    setError(null)
    try {
      await onSave(shifts)
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  const count = chosenDays.length
  return (
    <form className="card shift-sheet" onSubmit={handleSubmit} aria-label="New shift">
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
          Start
          <input type="time" value={form.start} onChange={set('start')} step={SNAP_MINUTES * 60} required />
        </label>
        <label className="form-field">
          End
          <input type="time" value={form.end} onChange={set('end')} step={SNAP_MINUTES * 60} required />
        </label>
        <div className="form-field form-grid-full">
          Bar days
          <DayPicker selected={days} onToggle={toggleDay} initialMonth={day} />
          <span className="field-hint">
            {count
              ? `Chosen: ${chosenDays.map((d) => format(d, 'EEE d.M.')).join(', ')}`
              : 'Click days in the calendar to choose them.'}
          </span>
        </div>
        <p className="field-hint form-grid-full">
          Times after midnight belong to the evening before: a Friday shift 20:00–02:00 ends at 02:00 on Saturday.
        </p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !count}>
          {saving ? 'Saving…' : count > 1 ? `Add ${count} shifts` : 'Add shift'}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default NewShiftForm

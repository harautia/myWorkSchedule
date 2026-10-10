import { useState } from 'react'
import { addMinutes } from 'date-fns'
import { useTranslation } from 'react-i18next'
import DayPicker from './DayPicker'
import {
  barDayStart,
  toTimeInput,
  formatDate,
  fromDayKey,
  openMinutes,
  SNAP_MINUTES,
  timeOnBarDay
} from '../utils/dates'
import { dayKey } from '../utils/lanes'
import { errorMessage } from '../utils/forms'
import { roleLabel } from '../i18n/labels'

const DEFAULT_SHIFT_MINUTES = 8 * 60

// Managers: plan the same shift for one employee on one or more bar days.
// Opened by clicking an empty spot in the week view (day and startMinutes =
// minutes from opening), or by "Add shift"; that day is chosen to start with.
// onSave([{ employeeId, start, end }, ...]) returns a promise.
const NewShiftForm = ({ employees, day, startMinutes, onSave, onCancel }) => {
  const { t } = useTranslation()
  const opening = barDayStart(day)
  const [form, setForm] = useState({
    employeeId: '',
    start: toTimeInput(addMinutes(opening, startMinutes)),
    end: toTimeInput(addMinutes(opening, Math.min(startMinutes + DEFAULT_SHIFT_MINUTES, openMinutes())))
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
    if (!chosenDays.length) return setError(t('shiftForm.chooseDay'))
    const shifts = chosenDays.map((shiftDay) => ({
      employeeId: Number(form.employeeId),
      start: timeOnBarDay(shiftDay, form.start),
      end: timeOnBarDay(shiftDay, form.end)
    }))
    if (shifts[0].end <= shifts[0].start) {
      return setError(t('shiftForm.endAfterStart'))
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
    <form className="card shift-sheet" onSubmit={handleSubmit} aria-label={t('shiftForm.newTitle')}>
      <h3 className="card-title">{t('shiftForm.newTitle')}</h3>
      <div className="form-grid">
        <label className="form-field">
          {t('shiftForm.employee')}
          <select value={form.employeeId} onChange={set('employeeId')} required autoFocus>
            <option value="" disabled>{t('shiftForm.choose')}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {t('shiftForm.employeeOption', { name: employee.name, role: roleLabel(t, employee.role) })}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          {t('shiftForm.start')}
          <input type="time" value={form.start} onChange={set('start')} step={SNAP_MINUTES * 60} required />
        </label>
        <label className="form-field">
          {t('shiftForm.end')}
          <input type="time" value={form.end} onChange={set('end')} step={SNAP_MINUTES * 60} required />
        </label>
        <div className="form-field form-grid-full">
          {t('shiftForm.barDays')}
          <DayPicker selected={days} onToggle={toggleDay} initialMonth={day} />
          <span className="field-hint">
            {count
              ? t('shiftForm.chosen', { days: chosenDays.map((d) => formatDate(d, 'EEE d.M.')).join(', ') })
              : t('shiftForm.chooseDaysHint')}
          </span>
        </div>
        <p className="field-hint form-grid-full">
          {t('shiftForm.afterMidnightHint')}
        </p>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !count}>
          {saving ? t('common.saving') : t('shiftForm.add', { count: Math.max(count, 1) })}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          {t('common.cancel')}
        </button>
      </div>
    </form>
  )
}

export default NewShiftForm

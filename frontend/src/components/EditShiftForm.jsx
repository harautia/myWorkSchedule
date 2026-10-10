import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { roleLabel } from '../i18n/labels'
import { barDay, formatDate, SNAP_MINUTES, timeOnBarDay, toTimeInput } from '../utils/dates'
import { errorMessage } from '../utils/forms'

// Touch screens: shifts can't be dragged there, so tapping one opens this
// form to change its employee and times on the same bar day, or delete it.
// onSave({ employeeId, start, end }) and onDelete() return promises.
const EditShiftForm = ({ shift, employees, onSave, onDelete, onCancel }) => {
  const { t } = useTranslation()
  const day = barDay(shift.start)
  const [form, setForm] = useState({
    employeeId: String(shift.employeeId),
    start: toTimeInput(shift.start),
    end: toTimeInput(shift.end)
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
      return setError(t('shiftForm.endAfterStart'))
    }
    run(() => onSave({ employeeId: Number(form.employeeId), start, end }))
  }

  return (
    <form className="card shift-sheet" onSubmit={handleSubmit} aria-label={t('shiftForm.editLabel')}>
      <h3 className="card-title">{t('shiftForm.editTitle', { day: formatDate(day, 'EEEE d.M.') })}</h3>
      <div className="form-grid">
        <label className="form-field">
          {t('shiftForm.employee')}
          <select value={form.employeeId} onChange={set('employeeId')} required>
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
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? t('common.saving') : t('common.save')}
        </button>
        <button type="button" className="btn btn-nav" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button type="button" className="btn btn-danger form-actions-end" onClick={() => run(onDelete)} disabled={saving}>
          {t('common.delete')}
        </button>
      </div>
    </form>
  )
}

export default EditShiftForm

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'
import { formatDate } from '../../utils/billing'

// Deleting a bar is scheduled 30 days ahead and can be undone, as for its
// owner (spec DATA-02). The admin can also delete it at once, which removes
// everything in it for good, after typing the bar's name.
// onChanged(bar): scheduled or undone; onDeleted(notice): deleted at once.
const DeleteBarSection = ({ bar, onChanged, onDeleted }) => {
  const { t, i18n } = useTranslation()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const confirmed = confirmation.trim() === bar.name

  const run = (request, then) => async (event) => {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      then(await request())
      setBusy(false)
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  const schedule = run(() => adminService.deleteBar(bar.id), onChanged)
  const undo = run(() => adminService.cancelDeletion(bar.id), onChanged)
  const deleteNow = run(() => adminService.deleteBarNow(bar.id), () => onDeleted(t('admin.deleted', { name: bar.name })))

  return (
    // Enter only ever schedules; deleting at once needs its own click.
    <form className="card danger-zone" onSubmit={bar.scheduledDeletionAt ? (event) => event.preventDefault() : schedule} aria-label={t('admin.deleteTitle')}>
      <h3 className="card-title">{t('admin.deleteTitle')}</h3>
      {bar.scheduledDeletionAt ? (
        <p>
          {t('barData.scheduled', { date: formatDate(bar.scheduledDeletionAt, i18n.language) })}{' '}
          <button type="button" className="link-button" disabled={busy} onClick={undo}>{t('barData.undo')}</button>
        </p>
      ) : (
        <p className="field-hint">{t('admin.deleteWarning', { name: bar.name })}</p>
      )}
      <label className="form-field">
        {t('admin.deleteConfirmLabel')}
        <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} placeholder={bar.name} autoComplete="off" />
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        {!bar.scheduledDeletionAt && (
          <button type="submit" className="btn btn-danger" disabled={!confirmed || busy}>
            {t('admin.scheduleDeletion')}
          </button>
        )}
        <button type="button" className="btn btn-danger" disabled={!confirmed || busy} onClick={deleteNow}>
          {busy ? t('admin.deleting') : t('admin.deleteButton')}
        </button>
      </div>
    </form>
  )
}

export default DeleteBarSection

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import barService, { EXPORT_URLS } from '../services/bar'
import { errorMessage } from '../utils/forms'
import { formatDate } from '../utils/billing'

// The owner's data downloads (spec DATA-01).
export const DataDownloads = () => {
  const { t } = useTranslation()
  return (
    <p className="form-actions">
      <a className="btn btn-nav" href={EXPORT_URLS.json} download>{t('barData.downloadJson')}</a>
      <a className="btn btn-nav" href={EXPORT_URLS.csv} download>{t('barData.downloadCsv')}</a>
    </p>
  )
}

// The owner's section of the bar settings: downloading the data, and
// deleting the bar, which is scheduled 30 days ahead and can be undone
// (DATA-02). onChanged(bar) gets the bar with its new scheduledDeletionAt.
const BarDataSection = ({ bar, onChanged }) => {
  const { t, i18n } = useTranslation()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = (request) => async (event) => {
    event?.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onChanged(await request())
      setConfirmation('')
    } catch (err) {
      setError(errorMessage(err))
    }
    setBusy(false)
  }

  return (
    <>
      <section className="card" aria-label={t('barData.title')}>
        <h3 className="card-title">{t('barData.title')}</h3>
        <p className="field-hint">{t('barData.hint')}</p>
        <DataDownloads />
      </section>

      <form className="card danger-zone" onSubmit={run(() => barService.scheduleDeletion(confirmation.trim()))} aria-label={t('barData.deleteTitle')}>
        <h3 className="card-title">{t('barData.deleteTitle')}</h3>
        {bar.scheduledDeletionAt ? (
          <>
            <p>{t('barData.scheduled', { date: formatDate(bar.scheduledDeletionAt, i18n.language) })}</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="button" className="btn btn-primary" disabled={busy} onClick={run(barService.cancelDeletion)}>
                {t('barData.undo')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="field-hint">{t('barData.deleteWarning', { name: bar.name })}</p>
            <label className="form-field">
              {t('admin.deleteConfirmLabel')}
              <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={bar.name} autoComplete="off" />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="form-actions">
              <button type="submit" className="btn btn-danger" disabled={busy || confirmation.trim() !== bar.name}>
                {t('barData.deleteButton')}
              </button>
            </div>
          </>
        )}
      </form>
    </>
  )
}

export default BarDataSection

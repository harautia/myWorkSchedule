import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Support mode (spec ADM-02): the admin opens the bar read-only, as its
// managers see it, after saying why. Below, the bar's audit log.
const SupportSection = ({ bar, onSupport }) => {
  const { t, i18n } = useTranslation()
  const [reason, setReason] = useState('')
  const [log, setLog] = useState(null)
  const [error, setError] = useState(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    adminService.getAuditLog(bar.id).then(setLog).catch(() => setLog([]))
  }, [bar.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setOpening(true)
    setError(null)
    try {
      await adminService.openSupport(bar.id, reason.trim())
      onSupport()
    } catch (err) {
      setError(errorMessage(err))
      setOpening(false)
    }
  }

  const time = (value) =>
    new Intl.DateTimeFormat(i18n.language === 'fi' ? 'fi-FI' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

  return (
    <section className="card" aria-label={t('support.title')}>
      <h3 className="card-title">{t('support.title')}</h3>
      <form onSubmit={handleSubmit}>
        <p className="field-hint">{t('support.hint', { name: bar.name })}</p>
        <label className="form-field">
          {t('support.reason')}
          <input value={reason} onChange={(event) => setReason(event.target.value)} minLength={3} maxLength={500} required />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-nav" disabled={opening}>
            {t('support.open')}
          </button>
        </div>
      </form>

      <h4>{t('support.logTitle')}</h4>
      {log === null && <p className="page-note">{t('app.loading')}</p>}
      {log?.length === 0 && <p className="page-note">{t('support.logEmpty')}</p>}
      {log?.length > 0 && (
        <ul className="audit-log">
          {log.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.createdAt}>{time(entry.createdAt)}</time>{' '}
              {t(`support.actions.${entry.action}`, { defaultValue: entry.action, ...entry.details })}
              {entry.actorName && <span className="muted"> – {entry.actorName}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default SupportSection

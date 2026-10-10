import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../utils/dates'

// When the week was locked, and by whom if known.
const lockedText = (t, { lockedAt, lockedBy }) =>
  lockedBy ? t('weekStatus.whenBy', { when: formatDateTime(lockedAt), name: lockedBy }) : formatDateTime(lockedAt)

// The shown week's state above the week view. Managers lock the week when its
// plan is ready (employees then see it) and unlock it to make changes;
// employees are told when a week hasn't been published yet.
// week = { status: 'planning' | 'locked', lockedAt, lockedBy, published }
const WeekStatusBar = ({ week, canEdit, busy, onLock, onUnlock, onAddShift }) => {
  const { t } = useTranslation()
  if (!week) return null

  if (!canEdit) {
    return week.published ? null : (
      <p className="week-status" role="status">
        {t('weekStatus.notPublished')}
      </p>
    )
  }

  const handleUnlock = () => {
    if (window.confirm(t('weekStatus.unlockConfirm'))) {
      onUnlock()
    }
  }

  if (week.status === 'locked') {
    return (
      <div className="week-status is-locked">
        <span className="status-badge is-locked">{t('weekStatus.lockedBadge')}</span>
        <span className="week-status-text">
          {t('weekStatus.lockedText', { when: lockedText(t, week) })}
        </span>
        <button type="button" className="btn btn-nav" onClick={handleUnlock} disabled={busy}>
          {t('weekStatus.unlock')}
        </button>
      </div>
    )
  }

  return (
    <div className="week-status is-planning">
      <span className="status-badge is-planning">{t('weekStatus.planningBadge')}</span>
      <span className="week-status-text">
        {week.published
          ? t('weekStatus.employeesSee', { when: lockedText(t, week) })
          : t('weekStatus.notPublishedYet')}{' '}
        {t('weekStatus.clickHint')}
      </span>
      {onAddShift && (
        <button type="button" className="btn btn-nav" onClick={onAddShift}>
          {t('weekStatus.addShift')}
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={onLock} disabled={busy}>
        {t('weekStatus.lock')}
      </button>
    </div>
  )
}

export default WeekStatusBar

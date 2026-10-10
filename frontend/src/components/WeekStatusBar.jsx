import { formatDateTime } from '../utils/dates'

const lockedText = ({ lockedAt, lockedBy }) =>
  `${formatDateTime(lockedAt)}${lockedBy ? ` by ${lockedBy}` : ''}`

// The shown week's state above the week view. Managers lock the week when its
// plan is ready (employees then see it) and unlock it to make changes;
// employees are told when a week hasn't been published yet.
// week = { status: 'planning' | 'locked', lockedAt, lockedBy, published }
const WeekStatusBar = ({ week, canEdit, busy, onLock, onUnlock, onAddShift }) => {
  if (!week) return null

  if (!canEdit) {
    return week.published ? null : (
      <p className="week-status" role="status">
        This week&apos;s schedule hasn&apos;t been published yet.
      </p>
    )
  }

  const handleUnlock = () => {
    if (window.confirm('Unlock this week for changes? Employees keep seeing the locked version until you lock the week again.')) {
      onUnlock()
    }
  }

  if (week.status === 'locked') {
    return (
      <div className="week-status is-locked">
        <span className="status-badge is-locked">Locked</span>
        <span className="week-status-text">
          Locked {lockedText(week)}. Employees see this week.
        </span>
        <button type="button" className="btn btn-nav" onClick={handleUnlock} disabled={busy}>
          Unlock week
        </button>
      </div>
    )
  }

  return (
    <div className="week-status is-planning">
      <span className="status-badge is-planning">Planning</span>
      <span className="week-status-text">
        {week.published
          ? `Employees see the version locked ${lockedText(week)}.`
          : 'Not published to employees yet.'}{' '}
        Click an empty spot in a day to add a shift.
      </span>
      {onAddShift && (
        <button type="button" className="btn btn-nav" onClick={onAddShift}>
          Add shift
        </button>
      )}
      <button type="button" className="btn btn-primary" onClick={onLock} disabled={busy}>
        Lock week
      </button>
    </div>
  )
}

export default WeekStatusBar

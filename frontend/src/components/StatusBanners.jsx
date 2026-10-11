import { useTranslation } from 'react-i18next'
import { managesBilling } from '../utils/access'
import { formatDate } from '../utils/billing'

// Notices about the bar's subscription (spec BILL-06), shown above every page:
// payment failed (past due) and read-only. The owner gets a way to the billing
// page.
export const SubscriptionBanner = ({ user, onBilling }) => {
  const { t } = useTranslation()
  const status = user.subscriptionStatus
  if (status !== 'past_due' && status !== 'read_only') return null
  const owner = managesBilling(user)
  return (
    <div className="notice-banner notice-warning" role="status">
      <span>{t(`banner.${status}.${owner ? 'owner' : 'staff'}`)}</span>
      {owner && (
        <button type="button" className="link-button" onClick={onBilling}>
          {t('banner.toBilling')}
        </button>
      )}
    </div>
  )
}

// An admin viewing a bar in support mode, read-only.
export const SupportBanner = ({ barName, onLeave }) => {
  const { t } = useTranslation()
  return (
    <div className="notice-banner notice-support" role="status">
      <span>{t('support.banner', { name: barName })}</span>
      <button type="button" className="link-button" onClick={onLeave}>
        {t('support.leave')}
      </button>
    </div>
  )
}

// The bar is scheduled for deletion. The owner (onSettings) can undo it in
// the bar settings.
export const DeletionBanner = ({ date, onSettings }) => {
  const { t, i18n } = useTranslation()
  return (
    <div className="notice-banner notice-warning" role="status">
      <span>{t('barData.banner', { date: formatDate(date, i18n.language) })}</span>
      {onSettings && (
        <button type="button" className="link-button" onClick={onSettings}>
          {t('barData.toSettings')}
        </button>
      )}
    </div>
  )
}

// Staff of a bar whose subscription isn't active: nothing to show but why.
export const SubscriptionInactive = () => {
  const { t } = useTranslation()
  return <p className="page-note">{t('banner.inactive')}</p>
}

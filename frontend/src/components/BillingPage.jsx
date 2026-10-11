import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataDownloads } from './BarDataSection'
import billingService from '../services/billing'
import { errorMessage } from '../utils/forms'
import { formatDate, PRICES } from '../utils/billing'

// The owner's billing page on the hosted service (spec BILL-02): the
// subscription's state, subscribing through Stripe Checkout, and Stripe's
// customer portal for the card, plan, invoices and cancelling.
// navigate(url): leaves the app for Stripe (replaceable in tests).
const BillingPage = ({ navigate = (url) => window.location.assign(url) }) => {
  const { t, i18n } = useTranslation()
  const [billing, setBilling] = useState(null)
  const [plan, setPlan] = useState('month')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    billingService.getBilling().then(setBilling).catch((err) => setError(errorMessage(err)))
  }, [])

  const go = (request) => async () => {
    setBusy(true)
    setError(null)
    try {
      navigate(await request())
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  if (error && !billing) return <p className="form-error" role="alert">{error}</p>
  if (!billing) return <p className="page-note">{t('app.loading')}</p>

  const date = (value) => formatDate(value, i18n.language)
  const { status } = billing

  return (
    <section className="billing-page">
      <h2 className="page-title">{t('billing.title')}</h2>

      <div className="card">
        <p>
          <span className={`badge badge-status-${status}`}>{t(`billing.status.${status}`)}</span>
        </p>
        {status === 'incomplete' && <p>{t('billing.incomplete')}</p>}
        {status === 'trialing' && billing.trialEndsAt && (
          <p>{t(billing.cancelAtPeriodEnd ? 'billing.trialEndsCancelled' : 'billing.trialEnds', { date: date(billing.trialEndsAt) })}</p>
        )}
        {status === 'active' && billing.currentPeriodEndsAt && (
          <p>{t(billing.cancelAtPeriodEnd ? 'billing.endsOn' : 'billing.renews', { date: date(billing.currentPeriodEndsAt) })}</p>
        )}
        {status === 'past_due' && <p>{t('billing.pastDue')}</p>}
        {status === 'read_only' && (
          <p>{t('billing.readOnly', { lockDate: date(billing.lockedAt), deletionDate: date(billing.scheduledDeletionAt) })}</p>
        )}
        {status === 'locked' && <p>{t('billing.locked', { deletionDate: date(billing.scheduledDeletionAt) })}</p>}
        {billing.billingInterval && !billing.canSubscribe && (
          <p className="field-hint">
            {t('billing.plan', {
              count: billing.barCount,
              price: billing.barCount * PRICES[billing.billingInterval],
              interval: t(`billing.per.${billing.billingInterval}`)
            })}
          </p>
        )}

        {billing.canSubscribe && (
          <fieldset className="form-section">
            <legend>{t('billing.choosePlan')}</legend>
            {['month', 'year'].map((value) => (
              <label key={value} className="radio-option">
                <input type="radio" name="interval" value={value} checked={plan === value} onChange={() => setPlan(value)} />
                {t(`billing.interval.${value}`, { price: PRICES[value] })}
              </label>
            ))}
            <p className="field-hint">
              {t(status === 'incomplete' ? 'billing.trialHint' : 'billing.noTrialHint', { count: billing.barCount })}
            </p>
          </fieldset>
        )}

        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          {billing.canSubscribe && (
            <button type="button" className="btn btn-primary" disabled={busy} onClick={go(() => billingService.startCheckout(plan))}>
              {status === 'incomplete' ? t('billing.startTrial') : t('billing.subscribe')}
            </button>
          )}
          {billing.hasCustomer && (
            <button type="button" className="btn btn-nav" disabled={busy} onClick={go(billingService.openPortal)}>
              {t('billing.manage')}
            </button>
          )}
        </div>
        <p className="field-hint">{t('billing.vatNote')}</p>
      </div>

      {(status === 'read_only' || status === 'locked') && (
        <section className="card" aria-label={t('barData.title')}>
          <h3 className="card-title">{t('barData.title')}</h3>
          <p className="field-hint">{t('barData.hint')}</p>
          <DataDownloads />
        </section>
      )}
    </section>
  )
}

export default BillingPage

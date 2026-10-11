// The owner's billing page on the hosted service (spec BILL-02): the
// subscription, Stripe Checkout to subscribe, and Stripe's customer portal.
// Mounted after requireAuth and resolveBar, without the subscription check,
// so a locked bar's owner can still pay.
const billingRouter = require('express').Router()
const config = require('../utils/config')
const billing = require('../utils/billing')
const Bars = require('../models/bars')
const Organizations = require('../models/organizations')

// Only the hosted service bills, only owners manage it, and support mode
// can't.
const requireOwner = (request, response, next) => {
  if (!billing.isHosted()) return response.status(404).json({ error: 'billing is not used on this server' })
  if (request.user.supportMode) return response.status(403).json({ error: 'support mode is read-only' })
  if (request.user.role !== 'owner') return response.status(403).json({ error: 'only the account owner manages billing' })
  next()
}

billingRouter.use(requireOwner)

// { status, trialEndsAt, billingInterval, currentPeriodEndsAt,
//   cancelAtPeriodEnd, endedAt, lockedAt, scheduledDeletionAt, barCount,
//   hasCustomer, canSubscribe }
billingRouter.get('/', async (request, response) => {
  const organization = await Organizations.getByBarId(request.barId)
  const lockedAt = organization.endedAt
    ? new Date(new Date(organization.endedAt).getTime() + config.READ_ONLY_DAYS * 24 * 60 * 60 * 1000).toISOString()
    : null
  response.json({
    status: organization.subscriptionStatus,
    trialEndsAt: organization.trialEndsAt,
    billingInterval: organization.billingInterval,
    currentPeriodEndsAt: organization.currentPeriodEndsAt,
    cancelAtPeriodEnd: organization.cancelAtPeriodEnd,
    endedAt: organization.endedAt,
    lockedAt,
    scheduledDeletionAt: organization.scheduledDeletionAt,
    barCount: await Organizations.countBars(organization.id),
    hasCustomer: Boolean(organization.stripeCustomerId),
    canSubscribe: billing.accessFor(organization.subscriptionStatus) !== 'full'
  })
})

// { interval: 'month' | 'year' } -> { url } of a Stripe Checkout page.
billingRouter.post('/checkout', async (request, response) => {
  const interval = request.body.interval ?? 'month'
  if (!['month', 'year'].includes(interval)) {
    return response.status(400).json({ error: 'interval must be month or year' })
  }
  const organization = await Organizations.getByBarId(request.barId)
  if (billing.accessFor(organization.subscriptionStatus) === 'full') {
    return response.status(409).json({ error: 'the subscription is already active; use Manage billing to change it' })
  }
  const bar = await Bars.getById(request.barId)
  const url = await billing.createCheckout(organization, { interval, owner: request.user, locale: bar.locale })
  response.json({ url })
})

// { url } of Stripe's customer portal: card, plan, invoices, cancelling.
billingRouter.post('/portal', async (request, response) => {
  const organization = await Organizations.getByBarId(request.barId)
  if (!organization.stripeCustomerId) {
    return response.status(409).json({ error: 'there is no subscription to manage yet' })
  }
  const bar = await Bars.getById(request.barId)
  response.json({ url: await billing.createPortal(organization, { locale: bar.locale }) })
})

module.exports = billingRouter

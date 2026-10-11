// Billing of the hosted service (spec §7.3, §10.2). Self-hosted copies never
// get here: every organization has full access and nothing is charged.
//
// Lifecycle: incomplete (card not given yet) -> trialing -> active, or
// past_due while Stripe retries a failed payment. When the subscription ends
// (payment finally failed, or a cancellation took effect) the bar is
// read_only for 14 days, then locked; the data is scheduled for deletion 90
// days after the end (D8). The status only changes through Stripe webhooks
// and the hourly job, never from the client.
const db = require('../db/db')
const config = require('./config')
const email = require('./email')
const logger = require('./logger')
const stripe = require('./stripe')
const AuditLog = require('../models/auditLog')
const Organizations = require('../models/organizations')

const DAY_MS = 24 * 60 * 60 * 1000

const isHosted = () => config.DEPLOYMENT_MODE === 'hosted'

// What a bar may do: 'full', 'read_only' or 'billing_only' (only the owner's
// billing page). Organizations without a status (self-hosted, or bars the
// platform admin created) have full access.
const accessFor = (status) => {
  if (!isHosted()) return 'full'
  if (status === 'read_only') return 'read_only'
  if (status === 'incomplete' || status === 'locked' || status === 'canceled') return 'billing_only'
  return 'full'
}

const ENDED = ['read_only', 'locked']

// Stripe's subscription status -> ours. Ended subscriptions start the
// read-only period.
const STATUS_FROM_STRIPE = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  incomplete: 'incomplete',
  unpaid: 'ended',
  canceled: 'ended',
  incomplete_expired: 'ended',
  paused: 'ended'
}

const fromUnix = (seconds) => (seconds ? new Date(seconds * 1000) : null)

// ---------- Emails ----------

// A date in the bar's language and timezone, e.g. '18 October 2026'.
const formatDate = (date, { locale, timezone }) =>
  new Intl.DateTimeFormat(locale === 'fi' ? 'fi-FI' : 'en-GB', { dateStyle: 'long', timeZone: timezone })
    .format(new Date(date))

// Emails the organization's owners once per kind and occasion (e.g. the trial
// end date), so the hourly job and repeated webhooks don't send it twice.
// Returns true when this call sent it.
const sendNotice = async (organizationId, kind, occasion, values = {}) => {
  const inserted = await db('billing_notices')
    .insert({ organization_id: organizationId, kind, occasion: String(occasion) })
    .onConflict(['organization_id', 'kind', 'occasion'])
    .ignore()
    .returning('kind')
  if (!inserted.length) return false

  const owners = await Organizations.owners(organizationId)
  for (const owner of owners) {
    const dates = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, value instanceof Date ? formatDate(value, owner) : value])
    )
    await email.send({
      to: owner.email,
      ...email.message(kind, owner.locale, { name: owner.name, barName: owner.barName, url: config.APP_URL, ...dates })
    })
  }
  return true
}

// ---------- Subscription changes (webhooks) ----------

const setStatus = async (organization, status, changes = {}, conn = db) => {
  await Organizations.update(organization.id, { subscription_status: status, ...changes }, conn)
  if (status !== organization.subscriptionStatus) {
    await AuditLog.add({
      action: 'subscription.status',
      organizationId: organization.id,
      details: { from: organization.subscriptionStatus, to: status }
    }, conn)
  }
}

// Takes a Stripe subscription into the organization: status, trial, period,
// interval. Called for every subscription webhook.
const applySubscription = async (organization, subscription) => {
  const item = subscription.items?.data?.[0]
  const details = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    trial_ends_at: fromUnix(subscription.trial_end),
    current_period_ends_at: fromUnix(item?.current_period_end ?? subscription.current_period_end),
    billing_interval: item?.price?.recurring?.interval ?? null,
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end)
  }
  const status = STATUS_FROM_STRIPE[subscription.status] ?? 'ended'

  if (status !== 'ended') {
    // Paying again after the end clears the end and the deletion date.
    await setStatus(organization, status, { ...details, ended_at: null, scheduled_deletion_at: null })
    return
  }
  // Already read-only or locked: the clock keeps running from the first end.
  // A sign-up that never finished Checkout stays incomplete.
  if (ENDED.includes(organization.subscriptionStatus) || organization.subscriptionStatus === 'incomplete') {
    await Organizations.update(organization.id, details)
    return
  }
  const endedAt = fromUnix(subscription.ended_at) ?? new Date()
  const lockedAt = new Date(endedAt.getTime() + config.READ_ONLY_DAYS * DAY_MS)
  const deletionAt = new Date(endedAt.getTime() + config.DELETE_AFTER_DAYS * DAY_MS)
  await setStatus(organization, 'read_only', { ...details, ended_at: endedAt, scheduled_deletion_at: deletionAt })
  await sendNotice(organization.id, 'readOnly', endedAt.toISOString(), { lockDate: lockedAt, deletionDate: deletionAt })
}

// The organization a subscription event is about: from the metadata set at
// Checkout, or the Stripe customer.
const organizationForSubscription = async (subscription) => {
  const id = Number(subscription.metadata?.organizationId)
  if (id) return Organizations.getById(id)
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
  return customer ? Organizations.findByStripeCustomer(customer) : null
}

// Events about an older subscription (e.g. the one that ended before the
// customer subscribed again) are ignored.
const isCurrentSubscription = (organization, subscription) =>
  !organization.stripeSubscriptionId ||
  organization.stripeSubscriptionId === subscription.id ||
  ENDED.includes(organization.subscriptionStatus) ||
  organization.subscriptionStatus === 'incomplete'

const handleSubscriptionEvent = async (subscription) => {
  const organization = await organizationForSubscription(subscription)
  if (!organization) return logger.info(`Stripe: no organization for subscription ${subscription.id}`)
  if (!isCurrentSubscription(organization, subscription)) return
  await applySubscription(organization, subscription)
}

// Handles one verified Stripe event (BILL-03).
const handleEvent = async (event) => {
  const object = event.data.object
  switch (event.type) {
    case 'checkout.session.completed': {
      if (object.mode !== 'subscription' || !object.subscription) return
      const organization = await Organizations.getById(Number(object.client_reference_id))
      if (!organization) return logger.info(`Stripe: no organization for checkout ${object.id}`)
      await Organizations.update(organization.id, { stripe_customer_id: object.customer })
      const subscription = await stripe.getClient().subscriptions.retrieve(object.subscription)
      await applySubscription({ ...organization, stripeSubscriptionId: null }, subscription)
      return
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'customer.subscription.paused':
    case 'customer.subscription.resumed':
      return handleSubscriptionEvent(object)
    case 'invoice.payment_failed': {
      const organization = await Organizations.findByStripeCustomer(object.customer)
      if (!organization) return
      await sendNotice(organization.id, 'paymentFailed', object.id)
      return
    }
    default:
      // Other events (e.g. invoice.paid) need nothing beyond the subscription events.
  }
}

// ---------- Checkout and the customer portal (BILL-02) ----------

// A Stripe Checkout page for the organization's subscription: one item per bar.
// The first subscription gets the 30-day trial (D4); subscribing again after
// the end doesn't. `owner` is the logged-in owner { email }. Returns its URL.
const createCheckout = async (organization, { interval, owner, locale }) => {
  const firstTime = !organization.stripeSubscriptionId && !organization.endedAt
  const params = {
    mode: 'subscription',
    line_items: [{ price: stripe.priceFor(interval), quantity: await Organizations.countBars(organization.id) }],
    client_reference_id: String(organization.id),
    metadata: { organizationId: String(organization.id) },
    subscription_data: {
      metadata: { organizationId: String(organization.id) },
      ...(firstTime ? { trial_period_days: config.TRIAL_DAYS } : {})
    },
    // The card is asked for even during the trial, which then charges automatically.
    payment_method_collection: 'always',
    // VAT (BILL-04): Finnish VAT, and reverse charge for EU businesses with a VAT number.
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    billing_address_collection: 'required',
    locale: locale === 'fi' ? 'fi' : 'en',
    success_url: `${config.APP_URL}/?billing=success`,
    cancel_url: `${config.APP_URL}/?billing=cancelled`
  }
  if (organization.stripeCustomerId) {
    params.customer = organization.stripeCustomerId
    params.customer_update = { address: 'auto', name: 'auto' }
  } else {
    params.customer_email = owner.email
  }
  const session = await stripe.getClient().checkout.sessions.create(params)
  return session.url
}

// Stripe's customer portal: card, monthly/yearly, invoices, cancelling.
const createPortal = async (organization, { locale }) => {
  const session = await stripe.getClient().billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    return_url: config.APP_URL,
    locale: locale === 'fi' ? 'fi' : 'en'
  })
  return session.url
}

// ---------- Number of bars (BILL-05) ----------

// Keeps the subscription's quantity equal to the organization's bars, with
// prorated charges. Failures are logged; the next change corrects them.
const syncBarCount = async (organizationId) => {
  if (!isHosted()) return
  const organization = await Organizations.getById(organizationId)
  if (!organization?.stripeSubscriptionId || accessFor(organization.subscriptionStatus) !== 'full') return
  try {
    const client = stripe.getClient()
    const subscription = await client.subscriptions.retrieve(organization.stripeSubscriptionId)
    const item = subscription.items.data[0]
    const count = await Organizations.countBars(organizationId)
    if (item && count > 0 && item.quantity !== count) {
      await client.subscriptionItems.update(item.id, { quantity: count, proration_behavior: 'create_prorations' })
    }
  } catch (error) {
    logger.error(`Stripe: updating the number of bars of organization ${organizationId} failed: ${error.message}`)
  }
}

// ---------- The hourly job ----------

// Moves read-only organizations to locked after 14 days, and sends the
// reminders: the trial ends in 7 days, the data will be deleted in 7 days.
// Returns what it did, for tests and logs.
const REMINDER_DAYS = 7

const runJobs = async (now = new Date()) => {
  const done = { locked: 0, trialReminders: 0, deletionReminders: 0 }
  if (!isHosted()) return done

  const lockBefore = new Date(now.getTime() - config.READ_ONLY_DAYS * DAY_MS)
  const toLock = await db('organizations').where({ subscription_status: 'read_only' }).where('ended_at', '<=', lockBefore)
  for (const row of toLock) {
    const organization = await Organizations.getById(row.id)
    await setStatus(organization, 'locked')
    await sendNotice(row.id, 'locked', row.ended_at.toISOString(), { deletionDate: row.scheduled_deletion_at })
    done.locked++
  }

  const soon = new Date(now.getTime() + REMINDER_DAYS * DAY_MS)
  const trials = await db('organizations')
    .where({ subscription_status: 'trialing', cancel_at_period_end: false })
    .where('trial_ends_at', '>', now)
    .where('trial_ends_at', '<=', soon)
  for (const row of trials) {
    if (await sendNotice(row.id, 'trialEnding', row.trial_ends_at.toISOString(), { date: row.trial_ends_at })) {
      done.trialReminders++
    }
  }

  const deletions = await db('organizations')
    .where({ subscription_status: 'locked' })
    .where('scheduled_deletion_at', '>', now)
    .where('scheduled_deletion_at', '<=', soon)
  for (const row of deletions) {
    if (await sendNotice(row.id, 'deletionSoon', row.scheduled_deletion_at.toISOString(), { deletionDate: row.scheduled_deletion_at })) {
      done.deletionReminders++
    }
  }
  return done
}

module.exports = {
  isHosted,
  accessFor,
  handleEvent,
  createCheckout,
  createPortal,
  syncBarCount,
  runJobs
}

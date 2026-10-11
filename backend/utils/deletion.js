// Deleting bars (spec DATA-02-03). Deleting is scheduled 30 days ahead and
// can be undone until then; the hourly job then deletes the bar for good,
// together with the bars of organizations whose retention period after an
// ended subscription is over (D8). Runs on self-hosted copies too.
const db = require('../db/db')
const billing = require('./billing')
const logger = require('./logger')
const stripe = require('./stripe')
const AuditLog = require('../models/auditLog')
const Bars = require('../models/bars')
const Organizations = require('../models/organizations')

const GRACE_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

const LIVE_SUBSCRIPTION = ['trialing', 'active', 'past_due']

// On the hosted service an organization keeps paying until all its bars are
// gone: when every bar is scheduled for deletion, its subscription ends at
// the end of the period; undoing continues it.
const syncSubscriptionEnd = async (organizationId) => {
  if (!billing.isHosted()) return
  const organization = await Organizations.getById(organizationId)
  if (!organization?.stripeSubscriptionId || !LIVE_SUBSCRIPTION.includes(organization.subscriptionStatus)) return
  const { remaining } = await db('bars')
    .where({ organization_id: organizationId })
    .whereNull('scheduled_deletion_at')
    .count('* as remaining')
    .first()
  const cancel = Number(remaining) === 0
  if (cancel === organization.cancelAtPeriodEnd) return
  try {
    await stripe.getClient().subscriptions.update(organization.stripeSubscriptionId, { cancel_at_period_end: cancel })
    await Organizations.update(organizationId, { cancel_at_period_end: cancel })
  } catch (error) {
    logger.error(`Stripe: ending the subscription of organization ${organizationId} failed: ${error.message}`)
  }
}

// Schedules the bar's deletion. Returns the date it happens.
const scheduleBarDeletion = async (barId, { actorUserId }) => {
  const deletionAt = new Date(Date.now() + GRACE_DAYS * DAY_MS)
  const bar = await Bars.getById(barId)
  const organization = await Organizations.getByBarId(barId)
  await db('bars').where({ id: barId }).update({ scheduled_deletion_at: deletionAt, deletion_requested_by: actorUserId })
  await AuditLog.add({
    action: 'bar.deletion_scheduled',
    actorUserId,
    organizationId: organization.id,
    barId,
    details: { deletionAt: deletionAt.toISOString() }
  })
  await billing.sendNotice(organization.id, 'barDeletionScheduled', `${barId}:${deletionAt.toISOString()}`, {
    barName: bar.name,
    deletionDate: deletionAt
  })
  await syncSubscriptionEnd(organization.id)
  return deletionAt
}

const cancelBarDeletion = async (barId, { actorUserId }) => {
  const organization = await Organizations.getByBarId(barId)
  await db('bars').where({ id: barId }).update({ scheduled_deletion_at: null, deletion_requested_by: null })
  await AuditLog.add({ action: 'bar.deletion_cancelled', actorUserId, organizationId: organization.id, barId })
  await syncSubscriptionEnd(organization.id)
}

// Deletes the bar for good: employees, shifts, weeks, and accounts that
// belong to no other bar; the organization goes with its last bar. A
// subscription still running for a deleted organization is cancelled.
const deleteBarNow = async (barId, { actorUserId = null, reason }) => {
  const bar = await Bars.getById(barId)
  if (!bar) return false
  const organization = await Organizations.getByBarId(barId)
  await Bars.remove(barId)
  await AuditLog.add({
    action: 'bar.delete',
    actorUserId,
    organizationId: organization.id,
    barId,
    details: { name: bar.name, reason }
  })

  if (await Organizations.getById(organization.id)) {
    await billing.syncBarCount(organization.id)
  } else if (billing.isHosted() && organization.stripeSubscriptionId && LIVE_SUBSCRIPTION.includes(organization.subscriptionStatus)) {
    try {
      await stripe.getClient().subscriptions.cancel(organization.stripeSubscriptionId)
    } catch (error) {
      logger.error(`Stripe: cancelling the subscription of deleted organization ${organization.id} failed: ${error.message}`)
    }
  }
  return true
}

// The hourly job: bars whose deletion date has passed, and the bars of
// organizations whose retention period has ended. Returns what it deleted.
const runJobs = async (now = new Date()) => {
  const done = { barsDeleted: 0 }
  const dueBars = await db('bars').where('scheduled_deletion_at', '<=', now).pluck('id')
  for (const barId of dueBars) {
    if (await deleteBarNow(barId, { reason: 'scheduled' })) done.barsDeleted++
  }

  const expired = await db('bars')
    .join('organizations', 'organizations.id', 'bars.organization_id')
    .where('organizations.subscription_status', 'locked')
    .where('organizations.scheduled_deletion_at', '<=', now)
    .pluck('bars.id')
  for (const barId of expired) {
    if (await deleteBarNow(barId, { reason: 'retention' })) done.barsDeleted++
  }
  return done
}

module.exports = { GRACE_DAYS, scheduleBarDeletion, cancelBarDeletion, deleteBarNow, runJobs }

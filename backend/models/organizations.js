const db = require('../db/db')

const iso = (date) => date?.toISOString() ?? null

const toDto = (row) => ({
  id: row.id,
  name: row.name,
  country: row.country,
  subscriptionStatus: row.subscription_status,
  trialEndsAt: iso(row.trial_ends_at),
  billingInterval: row.billing_interval,
  currentPeriodEndsAt: iso(row.current_period_ends_at),
  cancelAtPeriodEnd: row.cancel_at_period_end,
  endedAt: iso(row.ended_at),
  scheduledDeletionAt: iso(row.scheduled_deletion_at),
  stripeCustomerId: row.stripe_customer_id,
  stripeSubscriptionId: row.stripe_subscription_id
})

// An organization: the customer, with one or more bars. `status` is the
// subscription status to start with, and `trialDays` sets the trial end; the
// hosted service starts at 'incomplete' until the card is given in Stripe
// Checkout. Self-hosted organizations have neither.
const create = async ({ name, country = null, status = null, trialDays = null }, conn = db) => {
  const [row] = await conn('organizations')
    .insert({
      name: name.trim(),
      country,
      subscription_status: status,
      trial_ends_at: trialDays ? conn.raw(`now() + interval '${Number(trialDays)} days'`) : null
    })
    .returning('id')
  return row.id
}

const getById = async (id, conn = db) => {
  const row = await conn('organizations').where({ id }).first()
  return row ? toDto(row) : null
}

const getByBarId = async (barId, conn = db) => {
  const row = await conn('organizations')
    .join('bars', 'bars.organization_id', 'organizations.id')
    .where('bars.id', barId)
    .first('organizations.*')
  return row ? toDto(row) : null
}

const findByStripeCustomer = async (customerId, conn = db) => {
  const row = await conn('organizations').where({ stripe_customer_id: customerId }).first()
  return row ? toDto(row) : null
}

// Columns by their database names, e.g. { subscription_status: 'active' }.
const update = (id, changes, conn = db) => conn('organizations').where({ id }).update(changes)

const countBars = async (id, conn = db) => {
  const { count } = await conn('bars').where({ organization_id: id }).count('* as count').first()
  return Number(count)
}

// Who gets billing emails: the owners, with the language and timezone of
// their bar. [{ email, name, locale, timezone, barName }]
const owners = (id, conn = db) =>
  conn('memberships')
    .join('users', 'users.id', 'memberships.user_id')
    .join('bars', 'bars.id', 'memberships.bar_id')
    .where({ 'bars.organization_id': id, 'memberships.role': 'owner' })
    .whereNotNull('users.email')
    .distinctOn('users.email')
    .select('users.email', 'users.name', 'bars.locale', 'bars.timezone', 'bars.name as barName')

// Who counts as active for the admin's list.
const ACTIVE_DAYS = 30

// Admin list (ADM-01): every organization with its bars, subscription, active
// employees (logged in during the last 30 days) and last activity. `search`
// matches organization and bar names; `status` filters by subscription status
// ('none': without one, e.g. self-hosted or created by the admin).
const listForAdmin = async ({ search, status } = {}) => {
  const query = db('organizations')
    .select(
      'organizations.*',
      db('memberships')
        .join('users', 'users.id', 'memberships.user_id')
        .join('bars', 'bars.id', 'memberships.bar_id')
        .whereRaw('bars.organization_id = organizations.id')
        .where('users.last_seen_at', '>', db.raw(`now() - interval '${ACTIVE_DAYS} days'`))
        .countDistinct('users.id')
        .as('active_users'),
      db('memberships')
        .join('users', 'users.id', 'memberships.user_id')
        .join('bars', 'bars.id', 'memberships.bar_id')
        .whereRaw('bars.organization_id = organizations.id')
        .max('users.last_seen_at')
        .as('last_active_at')
    )
    .orderBy('organizations.name')
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
    query.where((where) =>
      where
        .whereILike('organizations.name', pattern)
        .orWhereExists(db('bars').whereRaw('bars.organization_id = organizations.id').whereILike('bars.name', pattern))
    )
  }
  if (status === 'none') query.whereNull('organizations.subscription_status')
  else if (status) query.where('organizations.subscription_status', status)

  const rows = await query
  const bars = await db('bars')
    .whereIn('organization_id', rows.map((row) => row.id))
    .orderBy('name')
    .select('id', 'name', 'organization_id')
  return rows.map((row) => ({
    ...toDto(row),
    bars: bars.filter((bar) => bar.organization_id === row.id).map(({ id, name }) => ({ id, name })),
    activeUsers: Number(row.active_users),
    lastActiveAt: iso(row.last_active_at)
  }))
}

module.exports = {
  ACTIVE_DAYS,
  create,
  getById,
  getByBarId,
  findByStripeCustomer,
  update,
  countBars,
  owners,
  listForAdmin
}

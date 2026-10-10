const db = require('../db/db')

// An organization: the customer, with one or more bars. `trialDays` starts the
// hosted service's free trial; self-hosted organizations have none.
const create = async ({ name, country = null, trialDays = null }, conn = db) => {
  const trial = trialDays
    ? { subscription_status: 'trialing', trial_ends_at: conn.raw(`now() + interval '${Number(trialDays)} days'`) }
    : {}
  const [row] = await conn('organizations').insert({ name: name.trim(), country, ...trial }).returning('id')
  return row.id
}

// { id, name, country, subscriptionStatus, trialEndsAt }, or null.
const getById = async (id) => {
  const row = await db('organizations').where({ id }).first()
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at?.toISOString() ?? null
  }
}

module.exports = { create, getById }

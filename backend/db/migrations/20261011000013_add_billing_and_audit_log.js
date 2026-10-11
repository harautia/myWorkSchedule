// Billing of the hosted service (spec BILL-01-07, §10.2) and the admin's
// support tools (ADM-01-02). Nothing here is used when self-hosting.
//
// - organizations: the Stripe customer and subscription, the billing interval
//   and period, and when the subscription ended. After it ends the bar is
//   read-only for 14 days, then locked; scheduled_deletion_at is 90 days after
//   the end (the deletion itself comes with spec DATA-03).
// - 'incomplete': signed up, card not given in Stripe Checkout yet.
// - stripe_events: webhook events already handled, so each runs only once.
// - billing_notices: billing emails already sent (e.g. "trial ends in 7 days").
// - audit_log: admin and billing events, e.g. opening a bar in support mode.
// - users.last_seen_at: for the admin's "active employees" and "last activity".
const STATUSES = ['incomplete', 'trialing', 'active', 'past_due', 'read_only', 'locked', 'canceled']
const OLD_STATUSES = ['trialing', 'active', 'past_due', 'read_only', 'locked', 'canceled']

const statusCheck = (statuses) => `subscription_status in (${statuses.map((status) => `'${status}'`).join(', ')})`

exports.up = async (knex) => {
  await knex.schema.alterTable('organizations', (table) => {
    table.dropChecks(['organizations_subscription_status_check'])
  })
  await knex.schema.alterTable('organizations', (table) => {
    table.check(statusCheck(STATUSES), [], 'organizations_subscription_status_check')
    table.text('stripe_customer_id').unique()
    table.text('stripe_subscription_id').unique()
    table.text('billing_interval')
    table.timestamp('current_period_ends_at', { useTz: true })
    table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
    table.timestamp('ended_at', { useTz: true })
    table.timestamp('scheduled_deletion_at', { useTz: true })
    table.check("billing_interval in ('month', 'year')", [], 'organizations_billing_interval_check')
  })

  await knex.schema.createTable('stripe_events', (table) => {
    table.text('id').primary()
    table.text('type').notNullable()
    table.timestamp('processed_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.createTable('billing_notices', (table) => {
    table.integer('organization_id').notNullable().references('id').inTable('organizations').onDelete('CASCADE')
    // What was sent, and for which occasion (e.g. the trial end date or invoice id).
    table.text('kind').notNullable()
    table.text('occasion').notNullable()
    table.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['organization_id', 'kind', 'occasion'])
  })

  // No foreign keys: the log outlives deleted bars and accounts.
  await knex.schema.createTable('audit_log', (table) => {
    table.increments('id').primary()
    table.integer('organization_id')
    table.integer('bar_id')
    table.integer('actor_user_id')
    table.text('action').notNullable()
    table.jsonb('details').notNullable().defaultTo('{}')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['bar_id', 'created_at'])
    table.index('created_at')
  })

  await knex.schema.alterTable('users', (table) => {
    table.timestamp('last_seen_at', { useTz: true })
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('last_seen_at')
  })
  await knex.schema.dropTable('audit_log')
  await knex.schema.dropTable('billing_notices')
  await knex.schema.dropTable('stripe_events')
  // Organizations still finishing sign-up had no status before.
  await knex('organizations').where({ subscription_status: 'incomplete' }).update({ subscription_status: null })
  await knex.schema.alterTable('organizations', (table) => {
    table.dropChecks(['organizations_subscription_status_check', 'organizations_billing_interval_check'])
    table.dropColumns(
      'stripe_customer_id',
      'stripe_subscription_id',
      'billing_interval',
      'current_period_ends_at',
      'cancel_at_period_end',
      'ended_at',
      'scheduled_deletion_at'
    )
  })
  await knex.schema.alterTable('organizations', (table) => {
    table.check(statusCheck(OLD_STATUSES), [], 'organizations_subscription_status_check')
  })
}

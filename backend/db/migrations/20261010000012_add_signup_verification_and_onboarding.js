// Self-service sign-up (spec SIGN-01-05, phase 2).
//
// - users.email_verified_at: sign-up checks that the email is the person's own
//   before they can invite staff. Existing accounts were made by an admin, a
//   manager or an invitation link, so they count as verified.
// - email_verifications: single-use links for that, stored as hashes.
// - organizations.subscription_status and trial_ends_at: the trial of the
//   hosted service. Self-hosted organizations have neither.
// - bars.onboarding_dismissed_at: the manager hid the onboarding checklist.
//   Existing bars are already up and running, so they don't get one.
exports.up = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.timestamp('email_verified_at', { useTz: true })
  })
  await knex('users').whereNotNull('email').update({ email_verified_at: knex.fn.now() })

  await knex.schema.createTable('email_verifications', (table) => {
    table.increments('id').primary()
    table.text('token_hash').notNullable().unique()
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('email').notNullable()
    table.timestamp('expires_at', { useTz: true }).notNullable()
    table.timestamp('used_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('organizations', (table) => {
    table.text('subscription_status')
    table.timestamp('trial_ends_at', { useTz: true })
    table.check(
      "subscription_status in ('trialing', 'active', 'past_due', 'read_only', 'locked', 'canceled')",
      [],
      'organizations_subscription_status_check'
    )
  })

  await knex.schema.alterTable('bars', (table) => {
    table.timestamp('onboarding_dismissed_at', { useTz: true })
  })
  await knex('bars').update({ onboarding_dismissed_at: knex.fn.now() })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('bars', (table) => {
    table.dropColumn('onboarding_dismissed_at')
  })
  await knex.schema.alterTable('organizations', (table) => {
    table.dropChecks(['organizations_subscription_status_check'])
    table.dropColumns('subscription_status', 'trial_ends_at')
  })
  await knex.schema.dropTable('email_verifications')
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verified_at')
  })
}

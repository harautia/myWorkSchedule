// Every session token carries the user's session_version. Changing the
// password bumps it, so a password reset (e.g. account recovery by an admin)
// also logs out any old sessions.
exports.up = (knex) =>
  knex.schema.alterTable('users', (table) => {
    table.integer('session_version').notNullable().defaultTo(0)
  })

exports.down = (knex) =>
  knex.schema.alterTable('users', (table) => {
    table.dropColumn('session_version')
  })

// Email login, invitations and password reset (spec AUTH-01-03).
//
// - users.email: login by email (or the old username). Stored in lower case and
//   unique. Accounts created from an invitation have no username.
// - invites: a manager invites a person by email; the invited person sets
//   their own password. The token is only stored as a hash.
// - password_resets: single-use "forgot password" tokens, also hashed.
exports.up = async (knex) => {
  await knex.schema.alterTable('users', (table) => {
    table.text('email').unique()
    table.text('username').nullable().alter()
    table.check('username is not null or email is not null', [], 'users_login_check')
  })

  await knex.schema.createTable('invites', (table) => {
    table.increments('id').primary()
    table.text('token_hash').notNullable().unique()
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
    table.text('email').notNullable()
    table.text('group_name').notNullable()
    table.integer('invited_by').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('expires_at', { useTz: true }).notNullable()
    table.timestamp('accepted_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['bar_id', 'employee_id'])
    table.check("group_name in ('managerGroup', 'employeeGroup')")
  })

  await knex.schema.createTable('password_resets', (table) => {
    table.increments('id').primary()
    table.text('token_hash').notNullable().unique()
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.timestamp('expires_at', { useTz: true }).notNullable()
    table.timestamp('used_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = async (knex) => {
  await knex.schema.dropTable('password_resets')
  await knex.schema.dropTable('invites')
  await knex.schema.alterTable('users', (table) => {
    table.dropChecks(['users_login_check'])
    table.dropColumn('email')
  })
  // Fails if accounts without a username exist; give them one first.
  await knex.schema.alterTable('users', (table) => {
    table.text('username').notNullable().alter()
  })
}

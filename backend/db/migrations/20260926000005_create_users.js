// A login account. bar_id is null for admins, who work across all bars.
// employee_id optionally links the account to the person on the schedule.
exports.up = (knex) =>
  knex.schema.createTable('users', (table) => {
    table.increments('id').primary()
    table.integer('bar_id').references('id').inTable('bars').onDelete('CASCADE')
    table.integer('employee_id').references('id').inTable('employees').onDelete('SET NULL')
    table.text('username').notNullable().unique()
    table.text('name').notNullable()
    table.text('password_hash').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index('bar_id')
  })

exports.down = (knex) => knex.schema.dropTable('users')

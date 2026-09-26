// A bar is the tenant: every employee, shift and day order belongs to one.
// Opening hours are per bar; closes_at earlier than opens_at means the bar
// closes after midnight (e.g. 10:00-04:00).
exports.up = (knex) =>
  knex.schema.createTable('bars', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.text('timezone').notNullable().defaultTo('Europe/Helsinki')
    table.time('opens_at').notNullable().defaultTo('10:00')
    table.time('closes_at').notNullable().defaultTo('04:00')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

exports.down = (knex) => knex.schema.dropTable('bars')

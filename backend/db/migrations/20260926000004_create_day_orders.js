// Custom side-by-side order of employees for one bar day. No row = legend order.
exports.up = (knex) =>
  knex.schema.createTable('day_orders', (table) => {
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.date('day').notNullable()
    table.jsonb('employee_ids').notNullable()
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['bar_id', 'day'])
  })

exports.down = (knex) => knex.schema.dropTable('day_orders')

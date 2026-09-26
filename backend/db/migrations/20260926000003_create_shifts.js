// bar_id is stored on shifts too (not only via employee) so every query can
// be scoped by bar directly, without a join.
exports.up = (knex) =>
  knex.schema.createTable('shifts', (table) => {
    table.increments('id').primary()
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
    table.timestamp('start', { useTz: true }).notNullable()
    table.timestamp('end', { useTz: true }).notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['bar_id', 'start'])
    table.check('?? > ??', ['end', 'start'])
  })

exports.down = (knex) => knex.schema.dropTable('shifts')

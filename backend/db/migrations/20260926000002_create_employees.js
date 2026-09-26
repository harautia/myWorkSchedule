exports.up = (knex) =>
  knex.schema.createTable('employees', (table) => {
    table.increments('id').primary()
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.text('name').notNullable()
    table.text('role').notNullable()
    table.text('color').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index('bar_id')
    table.check("role in ('manager', 'waiter')")
  })

exports.down = (knex) => knex.schema.dropTable('employees')

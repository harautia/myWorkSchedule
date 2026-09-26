// Which groups a user belongs to. A user can be in several groups.
exports.up = (knex) =>
  knex.schema.createTable('user_groups', (table) => {
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('group_name').notNullable()
    table.primary(['user_id', 'group_name'])
    table.check("group_name in ('adminGroup', 'managerGroup', 'employeeGroup')")
  })

exports.down = (knex) => knex.schema.dropTable('user_groups')

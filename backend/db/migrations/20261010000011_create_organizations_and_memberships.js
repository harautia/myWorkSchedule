// Organizations and memberships (spec §10, phase 2).
//
// - organizations: the customer. Each existing bar gets its own organization
//   with the same name.
// - memberships: which bars a user belongs to, with which role (owner /
//   manager / employee) and which employee row is theirs. Replaces
//   users.bar_id, users.employee_id and the bar groups of user_groups.
//   Each bar's oldest manager becomes its owner.
// - users.is_admin replaces adminGroup. Admins have no memberships.
// - invites.group_name becomes invites.role.
//
// Knex runs a migration in one transaction, so a failed upgrade changes nothing.
const ROLES = ['owner', 'manager', 'employee']

exports.up = async (knex) => {
  await knex.schema.createTable('organizations', (table) => {
    table.increments('id').primary()
    table.text('name').notNullable()
    table.text('country') // ISO 3166-1 alpha-2, e.g. 'FI'
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })

  await knex.schema.alterTable('bars', (table) => {
    table.integer('organization_id').references('id').inTable('organizations').onDelete('CASCADE')
    table.index('organization_id')
  })
  const bars = await knex('bars').select('id', 'name', 'created_at').orderBy('id')
  for (const bar of bars) {
    const [organization] = await knex('organizations')
      .insert({ name: bar.name, created_at: bar.created_at })
      .returning('id')
    await knex('bars').where({ id: bar.id }).update({ organization_id: organization.id })
  }
  await knex.schema.alterTable('bars', (table) => {
    table.integer('organization_id').notNullable().alter()
  })

  await knex.schema.createTable('memberships', (table) => {
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.integer('employee_id').references('id').inTable('employees').onDelete('SET NULL')
    table.text('role').notNullable()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['user_id', 'bar_id'])
    table.index('bar_id')
    // An employee row belongs to at most one account.
    table.unique(['employee_id'])
    table.check(`role in (${ROLES.map((role) => `'${role}'`).join(', ')})`, [], 'memberships_role_check')
  })
  await knex.raw(`
    INSERT INTO memberships (user_id, bar_id, employee_id, role, created_at)
    SELECT users.id, users.bar_id, users.employee_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM user_groups
        WHERE user_groups.user_id = users.id AND user_groups.group_name = 'managerGroup'
      ) THEN 'manager' ELSE 'employee' END,
      users.created_at
    FROM users
    WHERE users.bar_id IS NOT NULL
  `)
  await knex.raw(`
    UPDATE memberships SET role = 'owner'
    FROM (
      SELECT DISTINCT ON (bar_id) user_id, bar_id
      FROM memberships
      WHERE role = 'manager'
      ORDER BY bar_id, created_at, user_id
    ) AS first_manager
    WHERE memberships.user_id = first_manager.user_id
      AND memberships.bar_id = first_manager.bar_id
  `)

  await knex.schema.alterTable('users', (table) => {
    table.boolean('is_admin').notNullable().defaultTo(false)
  })
  await knex('users')
    .whereIn('id', knex('user_groups').where({ group_name: 'adminGroup' }).select('user_id'))
    .update({ is_admin: true })

  await knex.schema.dropTable('user_groups')
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('bar_id')
    table.dropColumn('employee_id')
  })

  await knex.schema.alterTable('invites', (table) => {
    table.dropChecks(['invites_group_name_check'])
    table.renameColumn('group_name', 'role')
  })
  await knex('invites').update({
    role: knex.raw("CASE role WHEN 'managerGroup' THEN 'manager' ELSE 'employee' END")
  })
  await knex.schema.alterTable('invites', (table) => {
    table.check("role in ('manager', 'employee')", [], 'invites_role_check')
  })
}

// Back to one bar per user. A user with several memberships keeps only the
// oldest one; the others are lost.
exports.down = async (knex) => {
  await knex.schema.alterTable('invites', (table) => {
    table.dropChecks(['invites_role_check'])
    table.renameColumn('role', 'group_name')
  })
  await knex('invites').update({
    group_name: knex.raw("CASE group_name WHEN 'manager' THEN 'managerGroup' ELSE 'employeeGroup' END")
  })
  await knex.schema.alterTable('invites', (table) => {
    table.check("group_name in ('managerGroup', 'employeeGroup')", [], 'invites_group_name_check')
  })

  await knex.schema.alterTable('users', (table) => {
    table.integer('bar_id').references('id').inTable('bars').onDelete('CASCADE')
    table.integer('employee_id').references('id').inTable('employees').onDelete('SET NULL')
    table.index('bar_id')
  })
  await knex.raw(`
    UPDATE users SET bar_id = first_membership.bar_id, employee_id = first_membership.employee_id
    FROM (
      SELECT DISTINCT ON (user_id) user_id, bar_id, employee_id
      FROM memberships
      ORDER BY user_id, created_at, bar_id
    ) AS first_membership
    WHERE users.id = first_membership.user_id
  `)

  await knex.schema.createTable('user_groups', (table) => {
    table.integer('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('group_name').notNullable()
    table.primary(['user_id', 'group_name'])
    table.check("group_name in ('adminGroup', 'managerGroup', 'employeeGroup')")
  })
  await knex.raw(`
    INSERT INTO user_groups (user_id, group_name)
    SELECT id, 'adminGroup' FROM users WHERE is_admin
    UNION
    SELECT users.id, CASE WHEN memberships.role = 'employee' THEN 'employeeGroup' ELSE 'managerGroup' END
    FROM users JOIN memberships ON memberships.user_id = users.id AND memberships.bar_id = users.bar_id
  `)

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('is_admin')
  })
  await knex.schema.dropTable('memberships')
  await knex.schema.alterTable('bars', (table) => {
    table.dropColumn('organization_id')
  })
  await knex.schema.dropTable('organizations')
}

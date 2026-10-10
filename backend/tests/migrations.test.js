// Upgrading a 0.1.0 database: migration 11 (organizations and memberships)
// must keep every account, bar and role, and `down` must undo it.
const { test, describe, before, after } = require('node:test')
const assert = require('node:assert')
const db = require('../db/db')

const MIGRATION = '20261010000011_create_organizations_and_memberships.js'

// The test database as a 0.1.0 installation would have it.
const insertVersion010Data = async () => {
  await db.raw('TRUNCATE password_resets, invites, published_shifts, schedule_weeks, user_groups, users, day_orders, shifts, employees, bars RESTART IDENTITY CASCADE')

  const [riverbend, harbour] = await db('bars')
    .insert([{ name: 'Riverbend' }, { name: 'Harbour' }])
    .returning('*')
  const employee = async (bar, name, role) => {
    const [row] = await db('employees').insert({ bar_id: bar.id, name, role, color: '#863bff' }).returning('*')
    return row
  }
  const ann = await employee(riverbend, 'Ann', 'manager')
  const ben = await employee(riverbend, 'Ben', 'manager')
  const cat = await employee(riverbend, 'Cat', 'waiter')
  const eve = await employee(riverbend, 'Eve', 'waiter')
  const fred = await employee(riverbend, 'Fred', 'manager')
  const dan = await employee(harbour, 'Dan', 'manager')

  const user = async (username, barId, employeeId, group, createdAt) => {
    const [row] = await db('users')
      .insert({ username, name: username, bar_id: barId, employee_id: employeeId, password_hash: 'x', created_at: createdAt })
      .returning('*')
    await db('user_groups').insert({ user_id: row.id, group_name: group })
    return row
  }
  // Ben gets the smaller id, but Ann has managed Riverbend longer: the oldest
  // manager becomes the owner, not the first id.
  await user('ben', riverbend.id, ben.id, 'managerGroup', '2026-09-20T10:00:00Z')
  await user('ann', riverbend.id, ann.id, 'managerGroup', '2026-09-10T10:00:00Z')
  await user('cat', riverbend.id, cat.id, 'employeeGroup', '2026-09-05T10:00:00Z')
  await user('dan', harbour.id, dan.id, 'managerGroup', '2026-09-15T10:00:00Z')
  await user('admin', null, null, 'adminGroup', '2026-09-01T10:00:00Z')

  const invite = (employeeId, group) => db('invites').insert({
    token_hash: `hash-${employeeId}`,
    bar_id: riverbend.id,
    employee_id: employeeId,
    email: `${employeeId}@example.com`,
    group_name: group,
    expires_at: '2030-01-01T00:00:00Z'
  })
  await invite(eve.id, 'employeeGroup')
  await invite(fred.id, 'managerGroup')

  return { riverbend, harbour, cat, eve, fred }
}

const memberships = async () =>
  (await db('memberships')
    .join('users', 'users.id', 'memberships.user_id')
    .join('bars', 'bars.id', 'memberships.bar_id')
    .select('users.username', 'bars.name as bar', 'memberships.role', 'memberships.employee_id')
    .orderBy('users.username'))

const groups = async () =>
  (await db('user_groups')
    .join('users', 'users.id', 'user_groups.user_id')
    .select('users.username', 'user_groups.group_name')
    .orderBy('users.username'))
    .map((row) => `${row.username}:${row.group_name}`)

const columns = async (table) => Object.keys(await db(table).columnInfo())

describe('migration 11: organizations and memberships', () => {
  let data

  before(async () => {
    await db.migrate.latest()
    await db.migrate.down({ name: MIGRATION })
    data = await insertVersion010Data()
    await db.migrate.up({ name: MIGRATION })
  })

  // Leave the database fully migrated and empty for the other test files.
  after(async () => {
    await db.migrate.latest()
    await db.raw('TRUNCATE organizations RESTART IDENTITY CASCADE')
    await db.raw('TRUNCATE users RESTART IDENTITY CASCADE')
    await db.destroy()
  })

  test('each bar gets its own organization with the same name', async () => {
    const rows = await db('bars')
      .join('organizations', 'organizations.id', 'bars.organization_id')
      .select('bars.name as bar', 'organizations.name as organization')
      .orderBy('bars.id')
    assert.deepStrictEqual(rows, [
      { bar: 'Riverbend', organization: 'Riverbend' },
      { bar: 'Harbour', organization: 'Harbour' }
    ])
  })

  test('bar accounts become memberships; the oldest manager is the owner', async () => {
    const rows = await memberships()
    assert.deepStrictEqual(
      rows.map(({ username, bar, role }) => `${username}:${bar}:${role}`),
      ['ann:Riverbend:owner', 'ben:Riverbend:manager', 'cat:Riverbend:employee', 'dan:Harbour:owner']
    )
    assert.strictEqual(rows.find((row) => row.username === 'cat').employee_id, data.cat.id)
  })

  test('adminGroup becomes is_admin, and admins have no bar', async () => {
    const admins = await db('users').where({ is_admin: true }).pluck('username')
    assert.deepStrictEqual(admins, ['admin'])
    assert.ok(!(await memberships()).some((row) => row.username === 'admin'))
  })

  test('the old columns and user_groups are gone', async () => {
    assert.strictEqual(await db.schema.hasTable('user_groups'), false)
    const userColumns = await columns('users')
    assert.ok(!userColumns.includes('bar_id'))
    assert.ok(!userColumns.includes('employee_id'))
  })

  test('open invitations keep their role', async () => {
    const rows = await db('invites').orderBy('employee_id').select('employee_id', 'role')
    assert.deepStrictEqual(rows, [
      { employee_id: data.eve.id, role: 'employee' },
      { employee_id: data.fred.id, role: 'manager' }
    ])
  })

  test('down restores bars, groups and invitations of 0.1.0', async () => {
    await db.migrate.down({ name: MIGRATION })
    try {
      assert.deepStrictEqual(await groups(), [
        'admin:adminGroup',
        'ann:managerGroup',
        'ben:managerGroup',
        'cat:employeeGroup',
        'dan:managerGroup'
      ])
      const cat = await db('users').where({ username: 'cat' }).first()
      assert.strictEqual(cat.bar_id, data.riverbend.id)
      assert.strictEqual(cat.employee_id, data.cat.id)
      const invites = await db('invites').orderBy('employee_id').pluck('group_name')
      assert.deepStrictEqual(invites, ['employeeGroup', 'managerGroup'])
      assert.strictEqual(await db.schema.hasTable('organizations'), false)
      assert.strictEqual(await db.schema.hasTable('memberships'), false)
    } finally {
      await db.migrate.up({ name: MIGRATION })
    }
    assert.strictEqual((await memberships()).length, 4)
  })
})

const db = require('../db/db')

const groupsByUser = async (userIds, conn = db) => {
  const rows = await conn('user_groups').whereIn('user_id', userIds).orderBy('group_name')
  const byUser = new Map(userIds.map((id) => [id, []]))
  rows.forEach((row) => byUser.get(row.user_id).push(row.group_name))
  return byUser
}

const toUser = (row, groups) => ({
  id: row.id,
  username: row.username,
  name: row.name,
  groups,
  barId: row.bar_id,
  barName: row.bar_name,
  employeeId: row.employee_id
})

// Includes the password hash; only for checking a login.
const findByUsername = (username) =>
  db('users').where({ username: username.toLowerCase() }).first()

const usernameTaken = async (username, conn = db) =>
  Boolean(await conn('users').where({ username: username.toLowerCase() }).first('id'))

// Where a username is in use: { barName } (null for accounts without a bar,
// e.g. admins), or null when the username is free.
const findUsernameOwner = async (username) => {
  const row = await db('users')
    .leftJoin('bars', 'bars.id', 'users.bar_id')
    .where('users.username', username.toLowerCase())
    .first('bars.name as bar_name')
  return row ? { barName: row.bar_name } : null
}

// The user as the rest of the app sees it, plus sessionVersion for checking
// that a session is still valid.
const getSessionUser = async (id) => {
  const row = await db('users')
    .leftJoin('bars', 'bars.id', 'users.bar_id')
    .where('users.id', id)
    .first('users.*', 'bars.name as bar_name')
  if (!row) return null

  const groups = (await groupsByUser([row.id])).get(row.id)
  return { ...toUser(row, groups), sessionVersion: row.session_version }
}

// The logged-in user: { id, username, name, groups, barId, barName, employeeId }
const getById = async (id) => {
  const user = await getSessionUser(id)
  if (!user) return null
  const { sessionVersion, ...rest } = user
  return rest
}

// Accounts of one bar: { employeeId -> { username, groups } } for the accounts
// that are linked to an employee.
const accountsByEmployee = async (barId) => {
  const rows = await db('users').where({ bar_id: barId }).whereNotNull('employee_id')
  const groups = await groupsByUser(rows.map((row) => row.id))
  return new Map(rows.map((row) => [row.employee_id, { username: row.username, groups: groups.get(row.id) }]))
}

// The account linked to one employee: { id, username, groups }, or null.
const findByEmployee = async (barId, employeeId) => {
  const row = await db('users').where({ bar_id: barId, employee_id: employeeId }).first()
  if (!row) return null
  const groups = (await groupsByUser([row.id])).get(row.id)
  return { id: row.id, username: row.username, groups }
}

// Admin view of every account in a bar, with the employee it is linked to.
const listByBar = async (barId) => {
  const rows = await db('users')
    .leftJoin('employees', 'employees.id', 'users.employee_id')
    .where('users.bar_id', barId)
    .orderBy('users.name')
    .select('users.*', 'employees.name as employee_name', 'employees.role as employee_role')
  const groups = await groupsByUser(rows.map((row) => row.id))
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    name: row.name,
    groups: groups.get(row.id),
    employee: row.employee_id ? { id: row.employee_id, name: row.employee_name, role: row.employee_role } : null,
    createdAt: row.created_at.toISOString()
  }))
}

const findInBar = async (barId, id) => (await listByBar(barId)).find((user) => user.id === id) ?? null

const create = async ({ barId, username, name, passwordHash, groups, employeeId = null }, conn = db) => {
  const [row] = await conn('users')
    .insert({
      bar_id: barId,
      employee_id: employeeId,
      username: username.toLowerCase(),
      name,
      password_hash: passwordHash
    })
    .returning('id')
  await conn('user_groups').insert(groups.map((group) => ({ user_id: row.id, group_name: group })))
  return row.id
}

// Changes the name and/or password. A new password also ends old sessions.
const update = async (id, { name, passwordHash }, conn = db) => {
  const changes = {}
  if (name !== undefined) changes.name = name
  if (passwordHash !== undefined) {
    changes.password_hash = passwordHash
    changes.session_version = conn.raw('session_version + 1')
  }
  if (Object.keys(changes).length) await conn('users').where({ id }).update(changes)
}

const remove = (id, conn = db) => conn('users').where({ id }).del()

const countInGroup = async (barId, group) => {
  const [{ count }] = await db('users')
    .join('user_groups', 'user_groups.user_id', 'users.id')
    .where({ 'users.bar_id': barId, 'user_groups.group_name': group })
    .count('* as count')
  return Number(count)
}

module.exports = {
  findByUsername,
  usernameTaken,
  findUsernameOwner,
  getSessionUser,
  getById,
  accountsByEmployee,
  findByEmployee,
  listByBar,
  findInBar,
  create,
  update,
  remove,
  countInGroup
}

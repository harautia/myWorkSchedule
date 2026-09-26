const db = require('../db/db')

const groupsByUser = async (userIds) => {
  const rows = await db('user_groups').whereIn('user_id', userIds).orderBy('group_name')
  const byUser = new Map(userIds.map((id) => [id, []]))
  rows.forEach((row) => byUser.get(row.user_id).push(row.group_name))
  return byUser
}

// Includes the password hash; only for checking a login.
const findByUsername = (username) =>
  db('users').where({ username: username.toLowerCase() }).first()

// The logged-in user as the rest of the app sees it.
const getById = async (id) => {
  const row = await db('users')
    .leftJoin('bars', 'bars.id', 'users.bar_id')
    .where('users.id', id)
    .first('users.*', 'bars.name as bar_name')
  if (!row) return null

  const groups = (await groupsByUser([row.id])).get(row.id)
  return {
    id: row.id,
    username: row.username,
    name: row.name,
    groups,
    barId: row.bar_id,
    barName: row.bar_name,
    employeeId: row.employee_id
  }
}

// Accounts of one bar: { employeeId -> { username, groups } } for the accounts
// that are linked to an employee.
const accountsByEmployee = async (barId) => {
  const rows = await db('users').where({ bar_id: barId }).whereNotNull('employee_id')
  const groups = await groupsByUser(rows.map((row) => row.id))
  return new Map(rows.map((row) => [row.employee_id, { username: row.username, groups: groups.get(row.id) }]))
}

module.exports = { findByUsername, getById, accountsByEmployee }

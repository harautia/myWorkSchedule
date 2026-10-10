const db = require('../db/db')
const { ADMIN, MANAGER, EMPLOYEE } = require('../utils/groups')

// Roles in a bar (memberships.role). The owner is also a manager.
const OWNER = 'owner'
const MANAGER_ROLES = [OWNER, 'manager']

// The groups the rest of the app checks, from the admin flag and the role in
// the current bar.
const groupsOf = (isAdmin, role) => {
  const groups = isAdmin ? [ADMIN] : []
  if (MANAGER_ROLES.includes(role)) groups.push(MANAGER)
  else if (role) groups.push(EMPLOYEE)
  return groups
}

const toUser = (row) => ({
  id: row.id,
  username: row.username,
  email: row.email,
  name: row.name,
  groups: groupsOf(row.is_admin, row.role),
  role: row.role ?? null,
  barId: row.bar_id ?? null,
  barName: row.bar_name ?? null,
  organizationId: row.organization_id ?? null,
  employeeId: row.employee_id ?? null,
  // An account without email has nothing to verify.
  emailVerified: !row.email || Boolean(row.email_verified_at)
})

// A user's memberships joined with their bars, the oldest first.
const membershipsQuery = (conn = db) =>
  conn('memberships')
    .join('bars', 'bars.id', 'memberships.bar_id')
    .orderBy([{ column: 'memberships.created_at' }, { column: 'memberships.bar_id' }])

// Accounts of one bar (users joined with their membership there).
const barAccountsQuery = (barId, conn = db) =>
  conn('memberships')
    .join('users', 'users.id', 'memberships.user_id')
    .where('memberships.bar_id', barId)

// Includes the password hash; only for checking a login.
const findByUsername = (username) =>
  db('users').where({ username: username.toLowerCase() }).first()

// For logging in: an email address (contains @) or a username. Includes the
// password hash.
const findByLogin = (login) => {
  const value = login.trim().toLowerCase()
  return db('users').where(value.includes('@') ? { email: value } : { username: value }).first()
}

const findByEmail = (email) => db('users').where({ email: email.trim().toLowerCase() }).first()

const usernameTaken = async (username, conn = db) =>
  Boolean(await conn('users').where({ username: username.toLowerCase() }).first('id'))

const emailTaken = async (email, conn = db) =>
  Boolean(await conn('users').where({ email: email.trim().toLowerCase() }).first('id'))

// Where a username is in use: { barName } (null for accounts without a bar,
// e.g. admins), or null when the username is free.
const findUsernameOwner = async (username) => {
  const user = await db('users').where({ username: username.toLowerCase() }).first('id')
  if (!user) return null
  const membership = await membershipsQuery().where('memberships.user_id', user.id).first('bars.name as bar_name')
  return { barName: membership?.bar_name ?? null }
}

// The user as the rest of the app sees it, plus sessionVersion for checking
// that a session is still valid. The current bar is the one the user joined
// first; switching between several bars comes later (spec TEN-04).
const getSessionUser = async (id, conn = db) => {
  const row = await conn('users').where({ id }).first()
  if (!row) return null

  const membership = await membershipsQuery(conn)
    .where('memberships.user_id', id)
    .first('memberships.*', 'bars.name as bar_name', 'bars.organization_id')
  return { ...toUser({ ...row, ...membership, id: row.id }), sessionVersion: row.session_version }
}

// The logged-in user: { id, username, email, name, groups, role, barId,
// barName, organizationId, employeeId, emailVerified }
const getById = async (id) => {
  const user = await getSessionUser(id)
  if (!user) return null
  const { sessionVersion, ...rest } = user
  return rest
}

const toAccount = (row) => ({
  username: row.username,
  email: row.email,
  groups: groupsOf(row.is_admin, row.role),
  role: row.role
})

// Accounts of one bar: { employeeId -> { username, email, groups, role } } for
// the accounts that are linked to an employee.
const accountsByEmployee = async (barId) => {
  const rows = await barAccountsQuery(barId)
    .whereNotNull('memberships.employee_id')
    .select('users.*', 'memberships.role', 'memberships.employee_id')
  return new Map(rows.map((row) => [row.employee_id, toAccount(row)]))
}

// The account linked to one employee: { id, username, email, groups, role }, or null.
const findByEmployee = async (barId, employeeId, conn = db) => {
  const row = await barAccountsQuery(barId, conn)
    .where('memberships.employee_id', employeeId)
    .first('users.*', 'memberships.role')
  return row ? { id: row.id, ...toAccount(row) } : null
}

// Whether an employee (in any bar) already has a login account.
const employeeHasAccount = async (employeeId, conn = db) =>
  Boolean(await conn('memberships').where({ employee_id: employeeId }).first('user_id'))

// Admin view of every account in a bar, with the employee it is linked to.
const listByBar = async (barId) => {
  const rows = await barAccountsQuery(barId)
    .leftJoin('employees', 'employees.id', 'memberships.employee_id')
    .orderBy('users.name')
    .select(
      'users.*',
      'memberships.role',
      'memberships.employee_id',
      'employees.name as employee_name',
      'employees.role as employee_role'
    )
  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.name,
    groups: groupsOf(row.is_admin, row.role),
    role: row.role,
    employee: row.employee_id ? { id: row.employee_id, name: row.employee_name, role: row.employee_role } : null,
    createdAt: row.created_at.toISOString()
  }))
}

const findInBar = async (barId, id) => (await listByBar(barId)).find((user) => user.id === id) ?? null

// An account needs a username, an email, or both. A bar account has a barId
// and a role ('owner', 'manager' or 'employee'); a platform admin has
// isAdmin and no bar. An email given by an admin or a manager, or reached
// through an invitation link, counts as verified; sign-up passes
// emailVerified: false and sends a verification link.
const create = async ({ barId = null, role = null, isAdmin = false, username, email, name, passwordHash, employeeId = null, emailVerified = true }, conn = db) => {
  const [row] = await conn('users')
    .insert({
      username: username ? username.toLowerCase() : null,
      email: email ? email.trim().toLowerCase() : null,
      email_verified_at: email && emailVerified ? conn.fn.now() : null,
      name,
      password_hash: passwordHash,
      is_admin: isAdmin
    })
    .returning('id')
  if (barId) {
    await conn('memberships').insert({ user_id: row.id, bar_id: barId, role, employee_id: employeeId })
  }
  return row.id
}

// Changes the name, email and/or password. A new password also ends old
// sessions. An empty email removes it (if the account has a username). Only
// admins and managers change emails, so a new one counts as verified.
const update = async (id, { name, email, passwordHash }, conn = db) => {
  const changes = {}
  if (name !== undefined) changes.name = name
  if (email !== undefined) {
    changes.email = email ? email.trim().toLowerCase() : null
    changes.email_verified_at = email ? conn.fn.now() : null
  }
  if (passwordHash !== undefined) {
    changes.password_hash = passwordHash
    changes.session_version = conn.raw('session_version + 1')
  }
  if (Object.keys(changes).length) await conn('users').where({ id }).update(changes)
}

// Marks the email verified, if it is still the account's email.
const markEmailVerified = (id, email, conn = db) =>
  conn('users').where({ id, email }).update({ email_verified_at: conn.fn.now() })

// Deletes accounts that no longer belong to any bar (admins excepted), e.g.
// after their bar was deleted.
const removeWithoutBar = (userIds, conn = db) =>
  conn('users')
    .whereIn('id', userIds)
    .where({ is_admin: false })
    .whereNotExists(conn('memberships').whereRaw('memberships.user_id = users.id'))
    .del()

// Takes the user out of a bar. The account itself is deleted when it has no
// other bar left. When the owner leaves, the bar's oldest remaining manager
// becomes the owner. Run inside a transaction.
const removeFromBar = async (barId, userId, conn) => {
  const [membership] = await conn('memberships').where({ bar_id: barId, user_id: userId }).del().returning('role')
  await removeWithoutBar([userId], conn)
  if (membership?.role !== OWNER) return

  const next = await conn('memberships')
    .where({ bar_id: barId, role: 'manager' })
    .orderBy([{ column: 'created_at' }, { column: 'user_id' }])
    .first('user_id')
  if (next) await conn('memberships').where({ bar_id: barId, user_id: next.user_id }).update({ role: OWNER })
}

// Owners and managers of a bar.
const countManagers = async (barId) => {
  const [{ count }] = await db('memberships')
    .where({ bar_id: barId })
    .whereIn('role', MANAGER_ROLES)
    .count('* as count')
  return Number(count)
}

module.exports = {
  findByUsername,
  findByLogin,
  findByEmail,
  emailTaken,
  usernameTaken,
  findUsernameOwner,
  getSessionUser,
  getById,
  accountsByEmployee,
  findByEmployee,
  employeeHasAccount,
  listByBar,
  findInBar,
  create,
  update,
  markEmailVerified,
  removeWithoutBar,
  removeFromBar,
  countManagers
}

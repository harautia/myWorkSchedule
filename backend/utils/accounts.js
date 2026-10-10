// Creating staff login accounts, shared by admins (managers) and managers
// (employees).
const Users = require('../models/users')
const Employees = require('../models/employees')
const { pickColor } = require('./colors')
const { hashPassword } = require('./passwords')

// Postgres error code, e.g. when two requests take the same username at once.
const UNIQUE_VIOLATION = '23505'

const pickAccount = ({ username, name, password, email } = {}) => ({
  username: typeof username === 'string' ? username.trim().toLowerCase() : username,
  name: typeof name === 'string' ? name.trim() : name,
  password,
  email: typeof email === 'string' ? email.trim().toLowerCase() : email
})

// Puts the person on the bar's schedule as an employee with the given role and
// creates their login account in `group`, linked to that employee. Run inside
// a transaction. Returns the new user id.
const createStaffAccount = async (conn, barId, { username, name, password, email }, { role, group }) => {
  const employee = await Employees.create(
    barId,
    { name, role, color: pickColor(await Employees.usedColors(barId, conn)) },
    conn
  )
  return Users.create(
    { barId, username, email, name, passwordHash: await hashPassword(password), groups: [group], employeeId: employee.id },
    conn
  )
}

module.exports = { UNIQUE_VIOLATION, pickAccount, createStaffAccount }

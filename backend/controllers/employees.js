const employeesRouter = require('express').Router()
const db = require('../db/db')
const Employees = require('../models/employees')
const Shifts = require('../models/shifts')
const Users = require('../models/users')
const { requireGroup } = require('../utils/middleware')
const { MANAGER, EMPLOYEE } = require('../utils/groups')
const { UNIQUE_VIOLATION, pickAccount, createStaffAccount } = require('../utils/accounts')
const { hashPassword } = require('../utils/passwords')
const { newAccountError, accountChangesError, parseId } = require('../utils/validation')

// Unlike the admin's message, this doesn't say which bar has the username:
// a manager must not learn anything about other bars.
const usernameTakenResponse = (response, username) =>
  response.status(409).json({ error: `username ${username} is already in use, please choose another` })

// Managers' view of the bar's employees: each with their login account (or
// null) and how many shifts they have.
const details = async (barId) => {
  const [employees, accounts, shiftCounts] = await Promise.all([
    Employees.getAll(barId),
    Users.accountsByEmployee(barId),
    Shifts.countsByEmployee(barId)
  ])
  return employees.map((employee) => ({
    ...employee,
    account: accounts.get(employee.id) ?? null,
    shiftCount: shiftCounts.get(employee.id) ?? 0
  }))
}

// Loads an employee of the manager's bar from :employeeId into
// request.employee (with request.account), or answers 404. Managers' accounts
// are managed by the admin, so they can't be changed here. Runs after the
// group check, so an employee can't probe ids.
const loadEmployee = async (request, response, next) => {
  const id = parseId(request.params.employeeId)
  const employee = id && await Employees.getById(request.barId, id)
  if (!employee) return response.status(404).json({ error: 'employee not found' })

  const account = await Users.findByEmployee(request.barId, employee.id)
  if (account?.groups.includes(MANAGER)) {
    return response.status(403).json({ error: 'managers are managed by the admin' })
  }
  request.employee = employee
  request.account = account
  next()
}

const manageEmployee = [requireGroup(MANAGER), loadEmployee]

// Name, role and colour of everyone in the bar, needed to show the schedule.
employeesRouter.get('/', async (request, response) => {
  const employees = await Employees.getAll(request.barId)
  response.json(employees)
})

// Managers only: employees together with their login account, if any.
employeesRouter.get('/details', requireGroup(MANAGER), async (request, response) => {
  response.json(await details(request.barId))
})

// Adds an employee to the manager's own bar: on the schedule as a waiter,
// with a login account in employeeGroup. { username, name, password }
employeesRouter.post('/', requireGroup(MANAGER), async (request, response) => {
  const account = pickAccount(request.body)
  const error = newAccountError(account)
  if (error) return response.status(400).json({ error })
  if (await Users.usernameTaken(account.username)) return usernameTakenResponse(response, account.username)

  let userId
  try {
    userId = await db.transaction((trx) =>
      createStaffAccount(trx, request.barId, account, { role: 'waiter', group: EMPLOYEE })
    )
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return usernameTakenResponse(response, account.username)
    throw err
  }

  const { employeeId } = await Users.getById(userId)
  const created = (await details(request.barId)).find((employee) => employee.id === employeeId)
  response.status(201).json(created)
})

// Renames an employee and/or sets a new password for their account. A new
// password also ends the employee's old sessions. { name?, password? }
employeesRouter.put('/:employeeId', manageEmployee, async (request, response) => {
  const { name, password } = request.body
  const error = accountChangesError({ name, password })
  if (error) return response.status(400).json({ error })
  if (password !== undefined && !request.account) {
    return response.status(400).json({ error: `${request.employee.name} has no login account` })
  }

  const passwordHash = password === undefined ? undefined : await hashPassword(password)
  await db.transaction(async (trx) => {
    if (name !== undefined) await Employees.rename(request.barId, request.employee.id, name.trim(), trx)
    if (request.account) await Users.update(request.account.id, { name: name?.trim(), passwordHash }, trx)
  })

  const updated = (await details(request.barId)).find((employee) => employee.id === request.employee.id)
  response.json(updated)
})

// Removes the employee from the bar: their login account, the employee and
// all their shifts. Cannot be undone.
employeesRouter.delete('/:employeeId', manageEmployee, async (request, response) => {
  await db.transaction(async (trx) => {
    if (request.account) await Users.remove(request.account.id, trx)
    await Employees.remove(request.barId, request.employee.id, trx)
  })
  response.status(204).end()
})

module.exports = employeesRouter

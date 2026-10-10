const employeesRouter = require('express').Router()
const db = require('../db/db')
const Employees = require('../models/employees')
const Shifts = require('../models/shifts')
const Users = require('../models/users')
const Bars = require('../models/bars')
const Invites = require('../models/invites')
const email = require('../utils/email')
const { pickColor } = require('../utils/colors')
const { requireGroup } = require('../utils/middleware')
const { MANAGER, EMPLOYEE } = require('../utils/groups')
const { UNIQUE_VIOLATION, pickAccount, createStaffAccount } = require('../utils/accounts')
const { hashPassword } = require('../utils/passwords')
const { newAccountError, accountChangesError, inviteError, isEmail, parseId } = require('../utils/validation')

// Unlike the admin's message, this doesn't say which bar has the username:
// a manager must not learn anything about other bars.
const usernameTakenResponse = (response, username) =>
  response.status(409).json({ error: `username ${username} is already in use, please choose another` })

const emailTakenResponse = (response, address) =>
  response.status(409).json({ error: `email ${address} is already in use` })

// Managers' view of the bar's employees: each with their login account (or
// null), an open invitation (or null) and how many shifts they have.
const details = async (barId) => {
  const [employees, accounts, invites, shiftCounts] = await Promise.all([
    Employees.getAll(barId),
    Users.accountsByEmployee(barId),
    Invites.pendingByEmployee(barId),
    Shifts.countsByEmployee(barId)
  ])
  return employees.map((employee) => ({
    ...employee,
    account: accounts.get(employee.id) ?? null,
    invite: accounts.has(employee.id) ? null : (invites.get(employee.id) ?? null),
    shiftCount: shiftCounts.get(employee.id) ?? 0
  }))
}

// Creates an invitation for an employee: { token, address }.
const createInvite = async (request, conn, { employeeId, address }) => {
  const token = await Invites.create(
    { barId: request.barId, employeeId, email: address, group: EMPLOYEE, invitedBy: request.user.id },
    conn
  )
  return { token, address }
}

// Emails the invitation. Returns { email, sent, url }: without email configured
// (sent false) the manager gets the link to pass on; when the email was sent,
// the link isn't returned.
const sendInvite = async (request, { token, address }, name) => {
  const bar = await Bars.getById(request.barId)
  const url = `${email.appUrl(request)}/?invite=${token}`
  const sent = await email.send({
    to: address,
    ...email.message('invite', bar.locale, { name, barName: bar.name, url, days: Invites.INVITE_DAYS })
  })
  return { email: address, sent, ...(sent ? {} : { url }) }
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

// Adds an employee to the manager's own bar, on the schedule as a waiter.
// - { name, email }: invites them; they set their own password (the usual way).
// - { name, username, password, email? }: creates the login account directly.
employeesRouter.post('/', requireGroup(MANAGER), async (request, response) => {
  if (request.body.password === undefined) return addByInvitation(request, response)

  const account = pickAccount(request.body)
  const error = newAccountError(account)
  if (error) return response.status(400).json({ error })
  if (await Users.usernameTaken(account.username)) return usernameTakenResponse(response, account.username)
  if (account.email && await Users.emailTaken(account.email)) return emailTakenResponse(response, account.email)

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

// The employee is on the schedule straight away, so shifts can be planned
// before they accept the invitation.
const addByInvitation = async (request, response) => {
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : request.body.name
  const address = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : request.body.email
  const error = inviteError({ name, email: address })
  if (error) return response.status(400).json({ error })
  if (await Users.emailTaken(address)) return emailTakenResponse(response, address)

  const { employee, created } = await db.transaction(async (trx) => {
    const employee = await Employees.create(
      request.barId,
      { name, role: 'waiter', color: pickColor(await Employees.usedColors(request.barId, trx)) },
      trx
    )
    return { employee, created: await createInvite(request, trx, { employeeId: employee.id, address }) }
  })

  const sent = await sendInvite(request, created, name)
  const row = (await details(request.barId)).find((item) => item.id === employee.id)
  response.status(201).json({ ...row, inviteSent: sent })
}

// Invites an employee who has no login account yet (again, e.g. when the
// first invitation expired). { email? }: defaults to the open invitation's email.
employeesRouter.post('/:employeeId/invite', manageEmployee, async (request, response) => {
  if (request.account) {
    return response.status(409).json({ error: `${request.employee.name} already has a login account` })
  }
  const pending = (await Invites.pendingByEmployee(request.barId)).get(request.employee.id)
  const raw = request.body.email ?? pending?.email
  const address = typeof raw === 'string' ? raw.trim().toLowerCase() : raw
  if (!isEmail(address)) return response.status(400).json({ error: 'email must be an email address, e.g. name@example.com' })
  if (await Users.emailTaken(address)) return emailTakenResponse(response, address)

  const created = await createInvite(request, db, { employeeId: request.employee.id, address })
  response.json(await sendInvite(request, created, request.employee.name))
})

// Renames an employee and/or changes their account's email or password. A
// new password also ends the employee's old sessions. { name?, email?, password? }
employeesRouter.put('/:employeeId', manageEmployee, async (request, response) => {
  const { name, password } = request.body
  const address = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : request.body.email
  const error = accountChangesError({ name, email: address, password })
  if (error) return response.status(400).json({ error })
  if ((password !== undefined || address !== undefined) && !request.account) {
    return response.status(400).json({ error: `${request.employee.name} has no login account` })
  }
  if (address === '' && !request.account.username) {
    return response.status(400).json({ error: 'the email is needed to log in, so it can\'t be removed' })
  }
  if (address && address !== request.account.email && await Users.emailTaken(address)) {
    return emailTakenResponse(response, address)
  }

  const passwordHash = password === undefined ? undefined : await hashPassword(password)
  await db.transaction(async (trx) => {
    if (name !== undefined) await Employees.rename(request.barId, request.employee.id, name.trim(), trx)
    if (request.account) await Users.update(request.account.id, { name: name?.trim(), email: address, passwordHash }, trx)
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

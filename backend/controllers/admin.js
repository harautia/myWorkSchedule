// adminGroup only (checked in app.js). Admins work across bars, so here the
// bar id comes from the URL, unlike the bar members' routes.
const adminRouter = require('express').Router()
const db = require('../db/db')
const Bars = require('../models/bars')
const Users = require('../models/users')
const Employees = require('../models/employees')
const AuditLog = require('../models/auditLog')
const Organizations = require('../models/organizations')
const billing = require('../utils/billing')
const { startSupport, endSupport, supportedBarId } = require('../utils/support')
const { UNIQUE_VIOLATION, pickAccount, createStaffAccount } = require('../utils/accounts')
const { hashPassword } = require('../utils/passwords')
const { MANAGER } = require('../utils/groups')
const { barError, pickBarSettings, newAccountError, accountChangesError, parseId } = require('../utils/validation')


// Usernames are unique across the whole service (login is by username only),
// so say where it is in use; this is admin-only, so naming the bar is fine.
const usernameTakenResponse = async (response, username) => {
  const owner = await Users.findUsernameOwner(username)
  const where = owner?.barName ? ` by a user in ${owner.barName}` : ''
  return response.status(409).json({
    error: `username ${username} is already in use${where}; usernames must be unique across all bars`
  })
}

const emailTakenResponse = (response, address) =>
  response.status(409).json({ error: `email ${address} is already in use` })

// Loads the bar from :barId into request.bar, or answers 404.
adminRouter.param('barId', async (request, response, next, value) => {
  const id = parseId(value)
  const bar = id && await Bars.getById(id)
  if (!bar) return response.status(404).json({ error: 'bar not found' })
  request.bar = bar
  next()
})

// Loads a manager of request.bar from :userId into request.manager, or answers 404.
adminRouter.param('userId', async (request, response, next, value) => {
  const id = parseId(value)
  const user = id && await Users.findInBar(request.bar.id, id)
  if (!user || !user.groups.includes(MANAGER)) {
    return response.status(404).json({ error: 'manager not found' })
  }
  request.manager = user
  next()
})

// Creates a manager's login account and puts them on the bar's schedule as an
// employee with role 'manager', linked to the account. The first manager of a
// new bar is its owner. Run inside a transaction.
const createManager = (conn, barId, manager, memberRole = 'manager') =>
  createStaffAccount(conn, barId, manager, { role: 'manager', memberRole })

const barDetails = async (barId) => ({
  bar: await Bars.getById(barId),
  users: await Users.listByBar(barId)
})

// All bars using the service, with employee and user counts.
adminRouter.get('/bars', async (request, response) => {
  response.json(await Bars.getAllWithCounts())
})

// Creates a bar together with its first manager: { bar: {...}, manager: { username, name, password } }
adminRouter.post('/bars', async (request, response) => {
  const bar = pickBarSettings(request.body.bar)
  const manager = pickAccount(request.body.manager)

  const error = barError(bar) ?? newAccountError(manager)
  if (error) return response.status(400).json({ error })
  if (await Users.usernameTaken(manager.username)) return usernameTakenResponse(response, manager.username)
  if (manager.email && await Users.emailTaken(manager.email)) return emailTakenResponse(response, manager.email)

  let barId
  try {
    barId = await db.transaction(async (trx) => {
      const id = await Bars.create(bar, trx)
      await createManager(trx, id, manager, 'owner')
      return id
    })
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return usernameTakenResponse(response, manager.username)
    throw err
  }

  response.status(201).json(await barDetails(barId))
})

// The bar with every user account in it (managers and employees).
adminRouter.get('/bars/:barId', async (request, response) => {
  response.json(await barDetails(request.bar.id))
})

// Deletes the bar with everything in it: employees, shifts, day orders and
// user accounts. Cannot be undone.
adminRouter.delete('/bars/:barId', async (request, response) => {
  const organization = await Organizations.getByBarId(request.bar.id)
  await Bars.remove(request.bar.id)
  await AuditLog.add({
    action: 'bar.delete',
    actorUserId: request.user.id,
    organizationId: organization.id,
    barId: request.bar.id,
    details: { name: request.bar.name }
  })
  // The organization's other bars (if any) are what it pays for now.
  await billing.syncBarCount(organization.id)
  response.status(204).end()
})

// Every organization with its bars, subscription, active employees and last
// activity (ADM-01). ?search= matches organization and bar names; ?status=
// filters by subscription status ('none' for organizations without one).
adminRouter.get('/organizations', async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim().slice(0, 100) : ''
  const status = typeof request.query.status === 'string' ? request.query.status : ''
  response.json(await Organizations.listForAdmin({ search, status }))
})

// Opens the bar in support mode (ADM-02): the admin sees it as its managers
// do, read-only, for an hour or until they leave. { reason } is required and
// goes to the audit log.
adminRouter.post('/bars/:barId/support', async (request, response) => {
  const reason = typeof request.body.reason === 'string' ? request.body.reason.trim() : ''
  if (reason.length < 3 || reason.length > 500) {
    return response.status(400).json({ error: 'reason is required (3-500 characters)' })
  }
  const organization = await Organizations.getByBarId(request.bar.id)
  await AuditLog.add({
    action: 'support.open',
    actorUserId: request.user.id,
    organizationId: organization.id,
    barId: request.bar.id,
    details: { reason }
  })
  startSupport(response, { userId: request.user.id, barId: request.bar.id })
  response.status(204).end()
})

// Leaves support mode.
adminRouter.delete('/support', async (request, response) => {
  const barId = supportedBarId(request, request.user.id)
  if (barId) {
    const organization = await Organizations.getByBarId(barId)
    await AuditLog.add({ action: 'support.close', actorUserId: request.user.id, organizationId: organization?.id, barId })
  }
  endSupport(response)
  response.status(204).end()
})

// The bar's audit log, newest first.
adminRouter.get('/bars/:barId/audit', async (request, response) => {
  response.json(await AuditLog.listByBar(request.bar.id))
})

adminRouter.put('/bars/:barId', async (request, response) => {
  const bar = pickBarSettings(request.body)
  const error = barError(bar)
  if (error) return response.status(400).json({ error })

  await Bars.update(request.bar.id, bar)
  response.json(await Bars.getById(request.bar.id))
})

adminRouter.post('/bars/:barId/managers', async (request, response) => {
  const manager = pickAccount(request.body)
  const error = newAccountError(manager)
  if (error) return response.status(400).json({ error })
  if (await Users.usernameTaken(manager.username)) return usernameTakenResponse(response, manager.username)
  if (manager.email && await Users.emailTaken(manager.email)) return emailTakenResponse(response, manager.email)

  let id
  try {
    id = await db.transaction((trx) => createManager(trx, request.bar.id, manager))
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return usernameTakenResponse(response, manager.username)
    throw err
  }

  response.status(201).json(await Users.findInBar(request.bar.id, id))
})

// Changes a manager's name, email and/or password. Setting a password is how a
// forgotten password is recovered; it also ends the manager's old sessions.
adminRouter.put('/bars/:barId/managers/:userId', async (request, response) => {
  const { name, password } = request.body
  const address = typeof request.body.email === 'string' ? request.body.email.trim().toLowerCase() : request.body.email
  const error = accountChangesError({ name, email: address, password })
  if (error) return response.status(400).json({ error })

  if (address && address !== request.manager.email && await Users.emailTaken(address)) {
    return emailTakenResponse(response, address)
  }

  const passwordHash = password === undefined ? undefined : await hashPassword(password)
  await db.transaction(async (trx) => {
    await Users.update(request.manager.id, { name: name?.trim(), email: address, passwordHash }, trx)
    // Keep the manager's name on the schedule in step with the account.
    if (name !== undefined && request.manager.employee) {
      await Employees.rename(request.bar.id, request.manager.employee.id, name.trim(), trx)
    }
  })
  response.json(await Users.findInBar(request.bar.id, request.manager.id))
})

// Takes the manager out of the bar and deletes their login account (unless
// they belong to another bar too). The employee on the schedule (if linked) is
// kept, so their past and planned shifts stay visible. A bar must keep at
// least one manager; when the owner is removed, the oldest remaining manager
// becomes the owner.
adminRouter.delete('/bars/:barId/managers/:userId', async (request, response) => {
  if ((await Users.countManagers(request.bar.id)) <= 1) {
    return response.status(409).json({ error: 'a bar must have at least one manager; add another manager first' })
  }
  await db.transaction((trx) => Users.removeFromBar(request.bar.id, request.manager.id, trx))
  response.status(204).end()
})

module.exports = adminRouter

// adminGroup only (checked in app.js). Admins work across bars, so here the
// bar id comes from the URL, unlike the bar members' routes.
const adminRouter = require('express').Router()
const db = require('../db/db')
const Bars = require('../models/bars')
const Users = require('../models/users')
const Employees = require('../models/employees')
const { UNIQUE_VIOLATION, pickAccount, createStaffAccount } = require('../utils/accounts')
const { hashPassword } = require('../utils/passwords')
const { MANAGER } = require('../utils/groups')
const { barError, newAccountError, accountChangesError, parseId } = require('../utils/validation')

const pickBar = ({ name, timezone, opensAt, closesAt } = {}) => ({ name, timezone, opensAt, closesAt })

// Usernames are unique across the whole service (login is by username only),
// so say where it is in use; this is admin-only, so naming the bar is fine.
const usernameTakenResponse = async (response, username) => {
  const owner = await Users.findUsernameOwner(username)
  const where = owner?.barName ? ` by a user in ${owner.barName}` : ''
  return response.status(409).json({
    error: `username ${username} is already in use${where}; usernames must be unique across all bars`
  })
}

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
// employee with role 'manager', linked to the account. Run inside a transaction.
const createManager = (conn, barId, manager) =>
  createStaffAccount(conn, barId, manager, { role: 'manager', group: MANAGER })

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
  const bar = pickBar(request.body.bar)
  const manager = pickAccount(request.body.manager)

  const error = barError(bar) ?? newAccountError(manager)
  if (error) return response.status(400).json({ error })
  if (await Users.usernameTaken(manager.username)) return usernameTakenResponse(response, manager.username)

  let barId
  try {
    barId = await db.transaction(async (trx) => {
      const id = await Bars.create(bar, trx)
      await createManager(trx, id, manager)
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
  await Bars.remove(request.bar.id)
  response.status(204).end()
})

adminRouter.put('/bars/:barId', async (request, response) => {
  const bar = pickBar(request.body)
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

  let id
  try {
    id = await db.transaction((trx) => createManager(trx, request.bar.id, manager))
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return usernameTakenResponse(response, manager.username)
    throw err
  }

  response.status(201).json(await Users.findInBar(request.bar.id, id))
})

// Changes a manager's name and/or password. Setting a password is how a
// forgotten password is recovered; it also ends the manager's old sessions.
adminRouter.put('/bars/:barId/managers/:userId', async (request, response) => {
  const { name, password } = request.body
  const error = accountChangesError({ name, password })
  if (error) return response.status(400).json({ error })

  const passwordHash = password === undefined ? undefined : await hashPassword(password)
  await db.transaction(async (trx) => {
    await Users.update(request.manager.id, { name: name?.trim(), passwordHash }, trx)
    // Keep the manager's name on the schedule in step with the account.
    if (name !== undefined && request.manager.employee) {
      await Employees.rename(request.bar.id, request.manager.employee.id, name.trim(), trx)
    }
  })
  response.json(await Users.findInBar(request.bar.id, request.manager.id))
})

// Deletes the manager's login account. The employee on the schedule (if
// linked) is kept, so their past and planned shifts stay visible. A bar must keep at least one manager.
adminRouter.delete('/bars/:barId/managers/:userId', async (request, response) => {
  if ((await Users.countInGroup(request.bar.id, MANAGER)) <= 1) {
    return response.status(409).json({ error: 'a bar must have at least one manager; add another manager first' })
  }
  await Users.remove(request.manager.id)
  response.status(204).end()
})

module.exports = adminRouter

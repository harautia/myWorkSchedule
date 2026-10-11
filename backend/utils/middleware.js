const jwt = require('jsonwebtoken')
const logger = require('./logger')
const config = require('./config')
const billing = require('./billing')
const Bars = require('../models/bars')
const Organizations = require('../models/organizations')
const Users = require('../models/users')
const { ADMIN, MANAGER } = require('./groups')
const { supportedBarId } = require('./support')

const { SESSION_COOKIE } = require('./session')

// Verifies the session cookie and loads the user (with groups) into
// request.user. Loading from the database on every request means group
// changes take effect immediately, not only after the next login.
const requireAuth = async (request, response, next) => {
  const token = request.cookies?.[SESSION_COOKIE]
  if (!token) return response.status(401).json({ error: 'not authenticated' })

  let payload
  try {
    payload = jwt.verify(token, config.SESSION_SECRET)
  } catch {
    return response.status(401).json({ error: 'not authenticated' })
  }

  const sessionUser = await Users.getSessionUser(payload.userId)
  // A token issued before the last password change is no longer valid.
  if (!sessionUser || payload.sessionVersion !== sessionUser.sessionVersion) {
    return response.status(401).json({ error: 'not authenticated' })
  }

  const { sessionVersion, lastSeenAt, ...user } = sessionUser
  request.user = await withSupport(request, user)
  if (!request.user.supportMode) {
    Users.markSeen(user.id, lastSeenAt).catch((error) => logger.error(`Updating last_seen_at failed: ${error.message}`))
  }
  next()
}

// An admin in support mode sees the supported bar as a manager would, and
// can't change anything there (readOnlyInSupport).
const withSupport = async (request, user) => {
  if (!user.groups.includes(ADMIN)) return user
  const barId = supportedBarId(request, user.id)
  const bar = barId && await Bars.getById(barId)
  if (!bar) return user
  const organization = await Organizations.getByBarId(bar.id)
  return {
    ...user,
    groups: [ADMIN, MANAGER],
    role: null,
    barId: bar.id,
    barName: bar.name,
    organizationId: organization.id,
    employeeId: null,
    subscriptionStatus: organization.subscriptionStatus,
    supportMode: true
  }
}

const readOnlyInSupport = (request, response, next) => {
  if (request.user.supportMode && request.method !== 'GET') {
    return response.status(403).json({ error: 'support mode is read-only' })
  }
  next()
}

// The bar's subscription decides what it may do on the hosted service (spec
// BILL-06): read-only bars may only read, and locked or unfinished ones only
// load their settings (the app then shows the billing page). Runs after
// resolveBar. 402 tells the app the subscription is the reason.
const requireSubscription = async (request, response, next) => {
  if (!billing.isHosted()) return next()
  const organization = await Organizations.getByBarId(request.barId)
  const access = billing.accessFor(organization?.subscriptionStatus)
  const status = organization?.subscriptionStatus ?? null
  if (access === 'read_only' && request.method !== 'GET') {
    return response.status(402).json({ error: 'this bar is read-only because its subscription has ended', subscriptionStatus: status })
  }
  if (access === 'billing_only' && !(request.method === 'GET' && request.baseUrl === '/api/bar' && request.path === '/')) {
    return response.status(402).json({ error: 'this bar has no active subscription', subscriptionStatus: status })
  }
  next()
}

// Allows the request if the user is in at least one of the given groups.
const requireGroup = (...groups) => (request, response, next) => {
  if (!groups.some((group) => request.user.groups.includes(group))) {
    return response.status(403).json({ error: 'forbidden' })
  }
  next()
}

const requestLogger = (request, response, next) => {
  logger.info('Method:', request.method)
  logger.info('Path:  ', request.path)
  // Never log passwords.
  const { password, ...body } = request.body || {}
  logger.info('Body:  ', password === undefined ? body : { ...body, password: '***' })
  logger.info('---')
  next()
}

const unknownEndpoint = (request, response) => {
  response.status(404).send({ error: 'unknown endpoint' })
}

const errorHandler = (error, request, response, next) => {
  logger.error(error.message)

  if (error.name === 'ValidationError') {
    return response.status(400).json({ error: error.message })
  }

  next(error)
}

module.exports = {
  SESSION_COOKIE,
  requireAuth,
  requireGroup,
  readOnlyInSupport,
  requireSubscription,
  requestLogger,
  unknownEndpoint,
  errorHandler
}

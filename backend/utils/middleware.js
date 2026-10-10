const jwt = require('jsonwebtoken')
const logger = require('./logger')
const config = require('./config')
const Users = require('../models/users')

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

  const { sessionVersion, ...user } = sessionUser
  request.user = user
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
  requestLogger,
  unknownEndpoint,
  errorHandler
}

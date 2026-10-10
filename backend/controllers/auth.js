const Users = require('../models/users')
const { verifyPassword } = require('../utils/passwords')
const { loginLimiter } = require('../utils/rateLimiter')
const { requireAuth } = require('../utils/middleware')
const { startSession, endSession } = require('../utils/session')

const authRouter = require('express').Router()

// Checked against when the account doesn't exist, so a login takes about the
// same time whether or not the email or username is valid.
const DUMMY_HASH = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128)

// { login, password }: login is an email address or a username. The older
// field name `username` still works.
authRouter.post('/login', loginLimiter, async (request, response) => {
  const login = request.body.login ?? request.body.username
  const { password } = request.body
  if (typeof login !== 'string' || !login.trim() || typeof password !== 'string') {
    return response.status(400).json({ error: 'email (or username) and password are required' })
  }

  const row = await Users.findByLogin(login)
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH)
  if (!row || !valid) {
    return response.status(401).json({ error: 'invalid email, username or password' })
  }

  startSession(response, row)
  response.json(await Users.getById(row.id))
})

authRouter.post('/logout', (request, response) => {
  endSession(response)
  response.json({ ok: true })
})

// The logged-in user: { id, username, email, name, groups, barId, barName, employeeId }
authRouter.get('/me', requireAuth, (request, response) => {
  response.json(request.user)
})

module.exports = authRouter

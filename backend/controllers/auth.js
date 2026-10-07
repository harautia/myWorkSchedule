const jwt = require('jsonwebtoken')
const config = require('../utils/config')
const Users = require('../models/users')
const { verifyPassword } = require('../utils/passwords')
const { loginLimiter } = require('../utils/rateLimiter')
const { SESSION_COOKIE, requireAuth } = require('../utils/middleware')

const authRouter = require('express').Router()

const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const baseCookieOptions = {
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: 'lax'
}

// Checked against when the username doesn't exist, so a login takes about the
// same time whether or not the username is valid.
const DUMMY_HASH = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128)

authRouter.post('/login', loginLimiter, async (request, response) => {
  const { username, password } = request.body
  if (typeof username !== 'string' || typeof password !== 'string') {
    return response.status(400).json({ error: 'username and password are required' })
  }

  const row = await Users.findByUsername(username)
  const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH)
  if (!row || !valid) {
    return response.status(401).json({ error: 'invalid username or password' })
  }

  const token = jwt.sign(
    { userId: row.id, sessionVersion: row.session_version },
    config.SESSION_SECRET,
    { expiresIn: '7d' }
  )
  response.cookie(SESSION_COOKIE, token, { ...baseCookieOptions, maxAge: SESSION_MAX_AGE_MS })
  response.json(await Users.getById(row.id))
})

authRouter.post('/logout', (request, response) => {
  response.clearCookie(SESSION_COOKIE, baseCookieOptions)
  response.json({ ok: true })
})

// The logged-in user: { id, username, name, groups, barId, barName, employeeId }
authRouter.get('/me', requireAuth, (request, response) => {
  response.json(request.user)
})

module.exports = authRouter

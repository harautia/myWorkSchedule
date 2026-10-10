// Login sessions: a signed token in an httpOnly cookie.
const jwt = require('jsonwebtoken')
const config = require('./config')

const SESSION_COOKIE = 'session'
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const cookieOptions = {
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: 'lax'
}

// Logs the user in: `user` is a users row (id and session_version).
const startSession = (response, user) => {
  const token = jwt.sign(
    { userId: user.id, sessionVersion: user.session_version },
    config.SESSION_SECRET,
    { expiresIn: '7d' }
  )
  response.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE_MS })
}

const endSession = (response) => response.clearCookie(SESSION_COOKIE, cookieOptions)

module.exports = { SESSION_COOKIE, startSession, endSession }

// Support mode (spec ADM-02): a platform admin opens one bar to see what its
// managers see, read-only. A separate short-lived cookie names the bar; it
// only works together with the admin's own session.
const jwt = require('jsonwebtoken')
const config = require('./config')

const SUPPORT_COOKIE = 'support'
const SUPPORT_MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

const cookieOptions = {
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: 'lax'
}

const startSupport = (response, { userId, barId }) => {
  const token = jwt.sign({ kind: 'support', userId, barId }, config.SESSION_SECRET, { expiresIn: '1h' })
  response.cookie(SUPPORT_COOKIE, token, { ...cookieOptions, maxAge: SUPPORT_MAX_AGE_MS })
}

const endSupport = (response) => response.clearCookie(SUPPORT_COOKIE, cookieOptions)

// The bar this admin is supporting, or null.
const supportedBarId = (request, userId) => {
  const token = request.cookies?.[SUPPORT_COOKIE]
  if (!token) return null
  try {
    const payload = jwt.verify(token, config.SESSION_SECRET, { algorithms: ['HS256'] })
    return payload.kind === 'support' && payload.userId === userId ? payload.barId : null
  } catch {
    return null
  }
}

module.exports = { startSupport, endSupport, supportedBarId }

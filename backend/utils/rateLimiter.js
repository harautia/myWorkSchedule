const rateLimit = require('express-rate-limit')

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Mistyped attempts shouldn't lock out a user who then logs in correctly.
  skipSuccessfulRequests: true,
  message: { error: 'too many login attempts, please try again later' }
})

// Password reset requests and invitation links: each request may send an email
// or try a token, so allow only a few per address.
const accountLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  // Tests call these endpoints many times in a row.
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: 'too many requests, please try again later' }
})

module.exports = { loginLimiter, accountLinkLimiter }

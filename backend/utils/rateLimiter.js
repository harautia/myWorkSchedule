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

module.exports = { loginLimiter }

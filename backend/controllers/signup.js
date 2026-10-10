// Self-service sign-up (spec SIGN-01-04) and email verification. Sign-up is
// only open when ALLOW_SIGNUP is on (always for the hosted service).
const signupRouter = require('express').Router()
const db = require('../db/db')
const config = require('../utils/config')
const Bars = require('../models/bars')
const EmailVerifications = require('../models/emailVerifications')
const Organizations = require('../models/organizations')
const Users = require('../models/users')
const email = require('../utils/email')
const turnstile = require('../utils/turnstile')
const { requireAuth } = require('../utils/middleware')
const { UNIQUE_VIOLATION, createStaffAccount } = require('../utils/accounts')
const { accountLinkLimiter, signupLimiter } = require('../utils/rateLimiter')
const { startSession } = require('../utils/session')
const { barError, passwordError, isEmail, LOCALES } = require('../utils/validation')

const EMAIL_TAKEN = 'an account with this email already exists; log in instead, or reset your password'
const INVALID_LINK = 'this link is no longer valid; log in and ask for a new one'

const text = (value) => (typeof value === 'string' ? value.trim() : value)

// ISO 3166-1 alpha-2, e.g. 'FI'.
const isCountry = (value) => typeof value === 'string' && /^[A-Z]{2}$/.test(value)

const pickSignup = (body = {}) => ({
  name: text(body.name),
  email: typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email,
  password: body.password,
  country: typeof body.country === 'string' ? body.country.trim().toUpperCase() : body.country,
  bar: {
    name: text(body.barName),
    timezone: body.timezone,
    opensAt: body.opensAt,
    closesAt: body.closesAt,
    locale: body.locale ?? 'en'
  }
})

const signupError = ({ name, email: address, password, country, bar }) => {
  if (typeof name !== 'string' || !name || name.length > 100) return 'name is required (max 100 characters)'
  if (!isEmail(address)) return 'email must be an email address, e.g. name@example.com'
  const error = passwordError(password)
  if (error) return error
  if (!isCountry(country)) return 'country must be a two-letter country code, e.g. FI'
  if (!LOCALES.includes(bar.locale)) return `locale must be one of: ${LOCALES.join(', ')}`
  const invalidBar = barError(bar)
  return invalidBar && invalidBar.replace(/^name /, 'barName ')
}

// Sends a link to confirm the user's email. Returns true when sent.
const sendVerification = async (request, { userId, name, address, barId }) => {
  const token = await EmailVerifications.create(userId, address)
  const bar = await Bars.getById(barId)
  return email.send({
    to: address,
    ...email.message('verifyEmail', bar.locale, {
      name,
      barName: bar.name,
      url: `${email.appUrl(request)}/?verify=${token}`,
      days: EmailVerifications.VERIFY_DAYS
    })
  })
}

// { name, email, password, barName, country, timezone, opensAt, closesAt,
//   locale?, captchaToken? }: creates the organization, its bar and the
// owner's account, who is also on the schedule as a manager, and logs in.
signupRouter.post('/signup', signupLimiter, async (request, response) => {
  if (!config.ALLOW_SIGNUP) return response.status(404).json({ error: 'sign-up is not available here' })

  const signup = pickSignup(request.body)
  const error = signupError(signup)
  if (error) return response.status(400).json({ error })
  if (!(await turnstile.verify(request.body.captchaToken, request.ip))) {
    return response.status(400).json({ error: 'the bot check failed; please try again' })
  }
  if (await Users.emailTaken(signup.email)) return response.status(409).json({ error: EMAIL_TAKEN })

  // Without email there is no way to verify, so the address is taken as given.
  const canVerify = email.isEnabled()
  let created
  try {
    created = await db.transaction(async (trx) => {
      const organizationId = await Organizations.create({
        name: signup.bar.name,
        country: signup.country,
        trialDays: config.DEPLOYMENT_MODE === 'hosted' ? config.TRIAL_DAYS : null
      }, trx)
      const barId = await Bars.create(signup.bar, trx, { organizationId })
      const userId = await createStaffAccount(
        trx,
        barId,
        { name: signup.name, email: signup.email, password: signup.password },
        { role: 'manager', memberRole: 'owner', emailVerified: !canVerify }
      )
      return { barId, userId }
    })
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return response.status(409).json({ error: EMAIL_TAKEN })
    throw err
  }

  if (canVerify) {
    await sendVerification(request, { userId: created.userId, name: signup.name, address: signup.email, barId: created.barId })
  }
  startSession(response, await db('users').where({ id: created.userId }).first())
  response.status(201).json(await Users.getById(created.userId))
})

// { token }: confirms the email the link was sent to. No login needed, so the
// link also works on another device.
signupRouter.post('/verify-email', accountLinkLimiter, async (request, response) => {
  const { token } = request.body
  if (typeof token !== 'string') return response.status(404).json({ error: INVALID_LINK })

  const done = await db.transaction(async (trx) => {
    const verification = await EmailVerifications.findValid(token, trx)
    if (!verification) return false
    await Users.markEmailVerified(verification.userId, verification.email, trx)
    await EmailVerifications.markUsed(verification.id, trx)
    return true
  })
  if (!done) return response.status(404).json({ error: INVALID_LINK })
  response.status(204).end()
})

// Sends the logged-in user a new verification link.
signupRouter.post('/verify-email/resend', accountLinkLimiter, requireAuth, async (request, response) => {
  const { user } = request
  if (user.emailVerified) return response.status(409).json({ error: 'your email is already verified' })
  if (!email.isEnabled() || !user.barId) return response.status(503).json({ error: 'email can\'t be sent from this server' })

  const sent = await sendVerification(request, { userId: user.id, name: user.name, address: user.email, barId: user.barId })
  if (!sent) return response.status(503).json({ error: 'sending the email failed; please try again later' })
  response.status(202).json({ ok: true })
})

module.exports = signupRouter

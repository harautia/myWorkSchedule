// Public endpoints behind the links sent by email: accepting an invitation
// and resetting a forgotten password. Tokens are single use.
const accountLinksRouter = require('express').Router()
const db = require('../db/db')
const Bars = require('../models/bars')
const Invites = require('../models/invites')
const PasswordResets = require('../models/passwordResets')
const Users = require('../models/users')
const email = require('../utils/email')
const logger = require('../utils/logger')
const { hashPassword } = require('../utils/passwords')
const { passwordError, isEmail } = require('../utils/validation')
const { accountLinkLimiter } = require('../utils/rateLimiter')
const { startSession } = require('../utils/session')

const INVALID_INVITE = 'this invitation is no longer valid; ask your manager for a new one'
const INVALID_RESET = 'this link is no longer valid; ask for a new one'

// The limit is set per route: this router is mounted on /api, and a
// router-wide middleware would also run for every other /api request.
// Who is invited where, to greet them: { name, email, barName, locale }.
accountLinksRouter.get('/invites/:token', accountLinkLimiter, async (request, response) => {
  const invite = await Invites.findValid(request.params.token)
  if (!invite) return response.status(404).json({ error: INVALID_INVITE })
  const { name, email: inviteEmail, barName, locale } = invite
  response.json({ name, email: inviteEmail, barName, locale })
})

// { password }: creates the invited person's account, linked to their place on
// the schedule, and logs them in.
accountLinksRouter.post('/invites/:token/accept', accountLinkLimiter, async (request, response) => {
  const error = passwordError(request.body.password)
  if (error) return response.status(400).json({ error })

  const outcome = await db.transaction(async (trx) => {
    const invite = await Invites.findValid(request.params.token, trx)
    if (!invite) return { status: 404, error: INVALID_INVITE }
    if (await Users.emailTaken(invite.email, trx)) {
      return { status: 409, error: 'an account with this email already exists; log in with it instead' }
    }
    if (await trx('users').where({ employee_id: invite.employeeId }).first('id')) {
      return { status: 409, error: 'this person already has an account; log in with it instead' }
    }

    const userId = await Users.create({
      barId: invite.barId,
      email: invite.email,
      name: invite.name,
      passwordHash: await hashPassword(request.body.password),
      groups: [invite.group],
      employeeId: invite.employeeId
    }, trx)
    await Invites.markAccepted(invite.id, trx)
    return { userId }
  })
  if (outcome.error) return response.status(outcome.status).json({ error: outcome.error })

  const row = await db('users').where({ id: outcome.userId }).first()
  startSession(response, row)
  response.status(201).json(await Users.getById(outcome.userId))
})

// { email }: sends a reset link if an account has this email. The answer is
// the same either way, so it can't be used to find out who has an account.
accountLinksRouter.post('/password-reset', accountLinkLimiter, async (request, response) => {
  const address = request.body.email
  if (isEmail(address) && email.isEnabled()) {
    const user = await Users.findByEmail(address)
    if (user) {
      const token = await PasswordResets.create(user.id)
      const bar = user.bar_id ? await Bars.getById(user.bar_id) : null
      const url = `${email.appUrl(request)}/?reset=${token}`
      await email.send({
        to: user.email,
        ...email.message('passwordReset', bar?.locale, { name: user.name, url, minutes: PasswordResets.RESET_MINUTES })
      })
    }
  } else if (!email.isEnabled()) {
    logger.info('Password reset requested, but email is not configured (SMTP_URL)')
  }
  response.status(202).json({ ok: true })
})

// { token, password }: sets the new password. This also ends every session of
// the account, so whoever had the old password is logged out.
accountLinksRouter.post('/password-reset/confirm', accountLinkLimiter, async (request, response) => {
  const { token, password } = request.body
  const error = passwordError(password)
  if (error) return response.status(400).json({ error })
  if (typeof token !== 'string') return response.status(404).json({ error: INVALID_RESET })

  const done = await db.transaction(async (trx) => {
    const reset = await PasswordResets.findValid(token, trx)
    if (!reset) return false
    await Users.update(reset.userId, { passwordHash: await hashPassword(password) }, trx)
    await PasswordResets.markUsed(reset.id, trx)
    return true
  })
  if (!done) return response.status(404).json({ error: INVALID_RESET })
  response.status(204).end()
})

module.exports = accountLinksRouter

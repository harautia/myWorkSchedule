const db = require('../db/db')
const { createToken, hashToken } = require('../utils/tokens')

// How long an email verification link works.
const VERIFY_DAYS = 7

// A new verification link for the user's email; earlier unused links stop
// working. Returns the token for the link.
const create = async (userId, email, conn = db) => {
  await conn('email_verifications').where({ user_id: userId }).whereNull('used_at').del()
  const { token, hash } = createToken()
  await conn('email_verifications').insert({
    token_hash: hash,
    user_id: userId,
    email,
    expires_at: conn.raw(`now() + interval '${VERIFY_DAYS} days'`)
  })
  return token
}

// A usable link (not used, not expired): { id, userId, email }, or null.
const findValid = async (token, conn = db) => {
  const row = await conn('email_verifications')
    .where({ token_hash: hashToken(token) })
    .whereNull('used_at')
    .where('expires_at', '>', conn.fn.now())
    .first()
  return row ? { id: row.id, userId: row.user_id, email: row.email } : null
}

const markUsed = (id, conn = db) => conn('email_verifications').where({ id }).update({ used_at: conn.fn.now() })

module.exports = { VERIFY_DAYS, create, findValid, markUsed }

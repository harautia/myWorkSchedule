const db = require('../db/db')
const { createToken, hashToken } = require('../utils/tokens')

// How long a "forgot password" link works.
const RESET_MINUTES = 60

// A new reset link for the user; earlier unused links stop working.
// Returns the token for the link.
const create = async (userId) => {
  await db('password_resets').where({ user_id: userId }).whereNull('used_at').del()
  const { token, hash } = createToken()
  await db('password_resets').insert({
    token_hash: hash,
    user_id: userId,
    expires_at: db.raw(`now() + interval '${RESET_MINUTES} minutes'`)
  })
  return token
}

// A usable reset (not used, not expired): { id, userId }, or null.
const findValid = async (token, conn = db) => {
  const row = await conn('password_resets')
    .where({ token_hash: hashToken(token) })
    .whereNull('used_at')
    .where('expires_at', '>', conn.fn.now())
    .first()
  return row ? { id: row.id, userId: row.user_id } : null
}

const markUsed = (id, conn = db) => conn('password_resets').where({ id }).update({ used_at: conn.fn.now() })

module.exports = { RESET_MINUTES, create, findValid, markUsed }

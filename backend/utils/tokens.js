// Random single-use tokens for invitation and password reset links. Only the
// hash is stored, so a copy of the database can't be used to take accounts over.
const crypto = require('crypto')

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex')

// { token: what goes in the link, hash: what goes in the database }
const createToken = () => {
  const token = crypto.randomBytes(32).toString('base64url')
  return { token, hash: hashToken(token) }
}

module.exports = { createToken, hashToken }

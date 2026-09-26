const crypto = require('node:crypto')
const { promisify } = require('node:util')

const scrypt = promisify(crypto.scrypt)
const KEY_LENGTH = 64

// Stored as 'scrypt$<salt hex>$<hash hex>'.
const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16)
  const hash = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

const verifyPassword = async (password, stored) => {
  const [scheme, saltHex, hashHex] = (stored || '').split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const given = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length)
  return crypto.timingSafeEqual(expected, given)
}

module.exports = { hashPassword, verifyPassword }

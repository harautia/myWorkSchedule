// Cloudflare Turnstile: checks that the sign-up form was filled in by a person.
// Without TURNSTILE_SECRET_KEY every request passes.
const config = require('./config')
const logger = require('./logger')

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const isEnabled = () => Boolean(config.TURNSTILE_SECRET_KEY)

const verifyWithCloudflare = async (token, ip) => {
  try {
    const response = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: config.TURNSTILE_SECRET_KEY, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(10000)
    })
    const result = await response.json()
    return result.success === true
  } catch (error) {
    logger.error(`Turnstile check failed: ${error.message}`)
    return false
  }
}

let verifier = verifyWithCloudflare
let enabled = isEnabled

// For tests: replace the check, e.g. with async (token) => token === 'ok'.
const setVerifier = (replacement) => {
  verifier = replacement ?? verifyWithCloudflare
  enabled = replacement ? () => true : isEnabled
}

// Resolves to true when the token is valid, or when Turnstile is off.
const verify = async (token, ip) => {
  if (!enabled()) return true
  if (typeof token !== 'string' || !token) return false
  return verifier(token, ip)
}

module.exports = { verify, setVerifier }

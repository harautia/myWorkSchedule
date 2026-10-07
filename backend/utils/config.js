// All settings come from environment variables (see .env.example, and the
// configuration reference on the project website).
require('dotenv').config({ quiet: true })
const { version: VERSION } = require('../package.json')

const env = process.env

// 'true'/'1'/'yes' and 'false'/'0'/'no'; empty or missing gives the fallback.
const flag = (value, fallback) => {
  if (value === undefined || value.trim() === '') return fallback
  return ['true', '1', 'yes'].includes(value.trim().toLowerCase())
}

const IS_PRODUCTION = env.NODE_ENV === 'production'

const PORT = env.PORT || 3003

const DATABASE_URL = env.NODE_ENV === 'test'
  ? env.TEST_DATABASE_URL
  : env.DATABASE_URL

const SESSION_SECRET = env.SESSION_SECRET

// 'self-hosted' (default): no billing. 'hosted': the official hosted service.
const DEPLOYMENT_MODE = env.DEPLOYMENT_MODE || 'self-hosted'
const DEPLOYMENT_MODES = ['self-hosted', 'hosted']

// Public sign-up of new organizations; reserved for the sign-up feature.
const ALLOW_SIGNUP = flag(env.ALLOW_SIGNUP, DEPLOYMENT_MODE === 'hosted')

// Run database migrations when the server starts.
const MIGRATE_ON_START = flag(env.MIGRATE_ON_START, true)

// Send the session cookie over HTTPS only. Turn off only for plain-HTTP testing.
const COOKIE_SECURE = flag(env.COOKIE_SECURE, IS_PRODUCTION)

// Who runs this copy, shown in the app footer. The source link is required by
// the AGPL: users of a changed copy must be able to get its source.
const APP_INFO = {
  operatorName: env.APP_OPERATOR_NAME || '',
  contactEmail: env.APP_CONTACT_EMAIL || '',
  privacyUrl: env.APP_PRIVACY_URL || '',
  sourceUrl: env.APP_SOURCE_URL || 'https://github.com/harautia/myWorkSchedule'
}

const PLACEHOLDER_SECRET = 'replace-with-a-long-random-string'
const MIN_SECRET_LENGTH = 32

// Settings that would make the server unsafe or broken; empty when all is well.
const problems = () => {
  const found = []
  if (!DATABASE_URL) found.push('DATABASE_URL is not set')
  if (!DEPLOYMENT_MODES.includes(DEPLOYMENT_MODE)) {
    found.push(`DEPLOYMENT_MODE must be one of: ${DEPLOYMENT_MODES.join(', ')}`)
  }
  if (!SESSION_SECRET) {
    found.push('SESSION_SECRET is not set')
  } else if (IS_PRODUCTION && (SESSION_SECRET === PLACEHOLDER_SECRET || SESSION_SECRET.length < MIN_SECRET_LENGTH)) {
    found.push(`SESSION_SECRET must be a random string of at least ${MIN_SECRET_LENGTH} characters, e.g. from: openssl rand -hex 32`)
  }
  return found
}

module.exports = {
  VERSION,
  IS_PRODUCTION,
  PORT,
  DATABASE_URL,
  SESSION_SECRET,
  DEPLOYMENT_MODE,
  ALLOW_SIGNUP,
  MIGRATE_ON_START,
  COOKIE_SECURE,
  APP_INFO,
  problems
}

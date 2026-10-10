// Parses an ISO timestamp string; returns a Date or null.
const parseTimestamp = (value) => {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const isDayKey = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())

const isId = (value) => Number.isInteger(value) && value > 0

// Route ids are strings; anything that isn't a positive integer can't match a row.
const parseId = (value) => (/^\d+$/.test(value) ? Number(value) : null)

// 'HH:mm', 24h clock
const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

const isTimezone = (value) => {
  if (typeof value !== 'string' || !value) return false
  try {
    new Intl.DateTimeFormat('en', { timeZone: value })
    return true
  } catch {
    return false
  }
}

const isNonEmptyText = (value, maxLength = 100) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/
const MIN_PASSWORD_LENGTH = 8

// Languages the app is translated into.
const LOCALES = ['en', 'fi']

const isHexColor = (value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)

// The bar settings a request may change; anything else in the body is ignored.
const pickBarSettings = ({ name, timezone, opensAt, closesAt, locale, clock24h, accentColor } = {}) =>
  ({ name, timezone, opensAt, closesAt, locale, clock24h, accentColor })

// Checks bar settings { name, timezone, opensAt, closesAt, locale?, clock24h?,
// accentColor? }; returns an error message or null. The optional display
// settings keep their current value when left out.
const barError = ({ name, timezone, opensAt, closesAt, locale, clock24h, accentColor }) => {
  if (!isNonEmptyText(name)) return 'name is required (max 100 characters)'
  if (!isTimezone(timezone)) return 'timezone must be an IANA timezone, e.g. Europe/Helsinki'
  if (!isTime(opensAt) || !isTime(closesAt)) return 'opensAt and closesAt must be times (HH:mm)'
  if (opensAt === closesAt) return 'opensAt and closesAt must differ'
  if (locale !== undefined && !LOCALES.includes(locale)) return `locale must be one of: ${LOCALES.join(', ')}`
  if (clock24h !== undefined && typeof clock24h !== 'boolean') return 'clock24h must be true or false'
  if (accentColor !== undefined && !isHexColor(accentColor)) return 'accentColor must be a colour like #863bff'
  return null
}

const passwordError = (password) =>
  typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= 200
    ? null
    : `password must be at least ${MIN_PASSWORD_LENGTH} characters`

// Checks a new account { username, name, password }; returns an error message or null.
const newAccountError = ({ username, name, password }) => {
  if (typeof username !== 'string' || !USERNAME_PATTERN.test(username.trim().toLowerCase())) {
    return 'username must be 3-32 characters: letters, numbers, dot, dash or underscore'
  }
  if (!isNonEmptyText(name)) return 'name is required (max 100 characters)'
  return passwordError(password)
}

// Checks changes to an existing account { name?, password? }; returns an error message or null.
const accountChangesError = ({ name, password }) => {
  if (name === undefined && password === undefined) return 'nothing to change: give name and/or password'
  if (name !== undefined && !isNonEmptyText(name)) return 'name is required (max 100 characters)'
  if (password !== undefined) return passwordError(password)
  return null
}

module.exports = {
  parseTimestamp,
  isDayKey,
  isId,
  parseId,
  isTime,
  isTimezone,
  LOCALES,
  pickBarSettings,
  barError,
  passwordError,
  newAccountError,
  accountChangesError
}

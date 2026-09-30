// The backend's error message for a failed request, or a generic one.
export const errorMessage = (error, fallback = 'Something went wrong, please try again') =>
  error?.response?.data?.error ?? fallback

export const MIN_PASSWORD_LENGTH = 8

export const EMPTY_BAR = { name: '', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00' }
export const EMPTY_ACCOUNT = { username: '', name: '', password: '' }

export const MANAGER_HINT =
  'The manager is also added to the schedule with the role manager, so shifts can be planned for them.'

const PASSWORD_CHARS = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// A random 14 character password without look-alike characters (0/O, 1/l/I),
// for a new account or for someone who has lost theirs.
export const generatePassword = (length = 14) => {
  const values = crypto.getRandomValues(new Uint32Array(length))
  return Array.from(values, (value) => PASSWORD_CHARS[value % PASSWORD_CHARS.length]).join('')
}

// Timezones offered in the bar form; any IANA name is accepted.
export const TIMEZONES =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Europe/Helsinki']

import i18n from '../i18n'

// The backend's error message for a failed request, or a generic one.
// (Messages from the server are in English for now.)
export const errorMessage = (error, fallback = i18n.t('common.error')) =>
  error?.response?.data?.error ?? fallback

export const MIN_PASSWORD_LENGTH = 8

export const DEFAULT_ACCENT = '#863bff'

export const EMPTY_BAR = {
  name: '',
  timezone: 'Europe/Helsinki',
  opensAt: '10:00',
  closesAt: '04:00',
  locale: 'en',
  clock24h: true,
  accentColor: DEFAULT_ACCENT
}

// The editable settings of a bar, e.g. to fill a form from GET /api/bar.
export const barSettings = ({ name, timezone, opensAt, closesAt, locale, clock24h, accentColor }) =>
  ({ name, timezone, opensAt, closesAt, locale, clock24h, accentColor })

// Languages the app is available in (D15).
export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'fi', label: 'Suomi' }
]
export const EMPTY_ACCOUNT = { username: '', name: '', password: '', email: '' }

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

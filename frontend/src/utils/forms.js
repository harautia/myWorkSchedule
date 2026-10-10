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

// Timezones offered in the bar form (IANA names, e.g. Europe/Helsinki).
export const TIMEZONES =
  typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['Europe/Helsinki']

// The timezones grouped by region for a <select>: [['Europe', ['Europe/Helsinki', …]], …].
// `current` is always included, even if this browser doesn't list it (e.g. 'UTC').
export const timezoneGroups = (current) => {
  const zones = TIMEZONES.includes(current) || !current ? TIMEZONES : [...TIMEZONES, current]
  const groups = new Map()
  for (const zone of [...zones].sort()) {
    const region = zone.includes('/') ? zone.split('/')[0] : 'Other'
    if (!groups.has(region)) groups.set(region, [])
    groups.get(region).push(zone)
  }
  return [...groups]
}

// The current time in a timezone, e.g. '22:50', to confirm the choice.
export const timeNowIn = (timezone) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(new Date())
  } catch {
    return null
  }
}

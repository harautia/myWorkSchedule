// The subscription statuses of the hosted service (spec §10.2), in lifecycle order.
export const SUBSCRIPTION_STATUSES = ['incomplete', 'trialing', 'active', 'past_due', 'read_only', 'locked']

// A date like '18 Oct 2026' / '18.10.2026', in the app's language.
export const formatDate = (value, language) =>
  new Intl.DateTimeFormat(language === 'fi' ? 'fi-FI' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value))

// The prices of the hosted service (D3), without VAT.
export const PRICES = { month: 10, year: 100 }

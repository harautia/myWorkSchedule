import api from './api'

// The owner's billing on the hosted service.
// { status, trialEndsAt, billingInterval, currentPeriodEndsAt, cancelAtPeriodEnd,
//   endedAt, lockedAt, scheduledDeletionAt, barCount, hasCustomer, canSubscribe }
const getBilling = () => api.get('/billing').then((res) => res.data)

// The URL of a Stripe Checkout page; interval is 'month' or 'year'.
const startCheckout = (interval) => api.post('/billing/checkout', { interval }).then((res) => res.data.url)

// The URL of Stripe's customer portal.
const openPortal = () => api.post('/billing/portal').then((res) => res.data.url)

export default { getBilling, startCheckout, openPortal }

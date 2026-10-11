// The Stripe client of the hosted service. Created on first use, so the app
// starts (and self-hosted copies run) without Stripe settings.
const Stripe = require('stripe')
const config = require('./config')

let client = null

const getClient = () => {
  client ??= new Stripe(config.STRIPE_SECRET_KEY)
  return client
}

// For tests: replace the client with a fake that has the methods the app uses.
const setClient = (replacement) => {
  client = replacement
}

// The price of one bar for 'month' or 'year' (D3).
const priceFor = (interval) => (interval === 'year' ? config.STRIPE_PRICE_YEARLY : config.STRIPE_PRICE_MONTHLY)

module.exports = { getClient, setClient, priceFor }

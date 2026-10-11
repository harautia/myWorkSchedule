// Stripe webhooks (spec BILL-03). Stripe signs every event; the signature is
// checked against the raw request body, so this route is mounted before
// express.json(). Each event is handled once, however often Stripe sends it.
const express = require('express')
const db = require('../db/db')
const config = require('../utils/config')
const billing = require('../utils/billing')
const logger = require('../utils/logger')
const stripe = require('../utils/stripe')

const stripeWebhookRouter = express.Router()

stripeWebhookRouter.post('/', express.raw({ type: 'application/json' }), async (request, response) => {
  if (!billing.isHosted()) return response.status(404).json({ error: 'billing is not used on this server' })

  let event
  try {
    event = stripe.getClient().webhooks.constructEvent(
      request.body,
      request.get('stripe-signature'),
      config.STRIPE_WEBHOOK_SECRET
    )
  } catch (error) {
    logger.info(`Stripe webhook rejected: ${error.message}`)
    return response.status(400).json({ error: 'invalid signature' })
  }

  const inserted = await db('stripe_events')
    .insert({ id: event.id, type: event.type })
    .onConflict('id')
    .ignore()
    .returning('id')
  if (!inserted.length) return response.json({ received: true, duplicate: true })

  try {
    await billing.handleEvent(event)
  } catch (error) {
    // Forget the event, so Stripe's retry handles it again.
    await db('stripe_events').where({ id: event.id }).del()
    logger.error(`Stripe event ${event.id} (${event.type}) failed: ${error.message}`)
    return response.status(500).json({ error: 'handling the event failed' })
  }
  response.json({ received: true })
})

module.exports = stripeWebhookRouter

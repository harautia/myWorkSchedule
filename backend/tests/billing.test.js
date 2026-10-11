// Billing of the hosted service, against a fake Stripe. Webhook signatures use
// Stripe's real signing code.
const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert')
const Stripe = require('stripe')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const config = require('../utils/config')
const billing = require('../utils/billing')
const email = require('../utils/email')
const stripe = require('../utils/stripe')
const Bars = require('../models/bars')
const { resetDb, loginAs, insertUser } = require('./helper')

const api = supertest(app)
const DAY_MS = 24 * 60 * 60 * 1000
const WEBHOOK_SECRET = 'whsec_test_secret'
const realWebhooks = new Stripe('sk_test_fake').webhooks

const SIGNUP = {
  name: 'Maija Owner',
  email: 'maija@example.com',
  password: 'maija-password',
  barName: 'Corner Pub',
  country: 'FI',
  timezone: 'Europe/Helsinki',
  opensAt: '11:00',
  closesAt: '02:00',
  locale: 'en'
}

const original = { ...config }
let calls
let subscriptions
let sentMails
let eventNumber = 0

const fakeStripe = () => ({
  webhooks: realWebhooks,
  checkout: {
    sessions: {
      create: async (params) => {
        calls.checkout.push(params)
        return { id: 'cs_test', url: 'https://checkout.stripe.test/cs_test' }
      }
    }
  },
  billingPortal: {
    sessions: {
      create: async (params) => {
        calls.portal.push(params)
        return { url: 'https://billing.stripe.test/portal' }
      }
    }
  },
  subscriptions: { retrieve: async (id) => subscriptions[id] },
  subscriptionItems: {
    update: async (id, params) => {
      calls.itemUpdates.push({ id, ...params })
      return {}
    }
  }
})

// A Stripe subscription object, as far as the app reads it.
const subscription = (id, organizationId, status, extra = {}) => {
  const now = Math.floor(Date.now() / 1000)
  subscriptions[id] = {
    id,
    object: 'subscription',
    customer: 'cus_maija',
    status,
    metadata: { organizationId: String(organizationId) },
    trial_end: status === 'trialing' ? now + 30 * 24 * 3600 : null,
    cancel_at_period_end: false,
    ended_at: null,
    items: { data: [{ id: `si_${id}`, quantity: 1, current_period_end: now + 30 * 24 * 3600, price: { recurring: { interval: 'month' } } }] },
    ...extra
  }
  return subscriptions[id]
}

// Sends an event to the webhook, signed like Stripe would.
const sendEvent = (type, object, { id = `evt_${++eventNumber}`, secret = WEBHOOK_SECRET } = {}) => {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } })
  const signature = realWebhooks.generateTestHeaderString({ payload, secret })
  return api.post('/api/stripe/webhook').set('Content-Type', 'application/json').set('Stripe-Signature', signature).send(payload)
}

const organization = (id) => db('organizations').where({ id }).first()

// A hosted sign-up: the owner's agent and their organization id.
const signUpOwner = async () => {
  const agent = supertest.agent(app)
  const response = await agent.post('/api/signup').send(SIGNUP).expect(201)
  return { owner: agent, organizationId: response.body.organizationId, user: response.body }
}

// Completes Checkout: the trial starts.
const completeCheckout = async (organizationId) => {
  subscription('sub_1', organizationId, 'trialing')
  await sendEvent('checkout.session.completed', {
    id: 'cs_test', object: 'checkout.session', mode: 'subscription', client_reference_id: String(organizationId), customer: 'cus_maija', subscription: 'sub_1'
  }).expect(200)
}

const newShift = (agent, employeeId) =>
  agent.post('/api/shifts').send({ employeeId, start: '2026-10-12T09:00:00Z', end: '2026-10-12T17:00:00Z' })

beforeEach(async () => {
  await resetDb()
  calls = { checkout: [], portal: [], itemUpdates: [] }
  subscriptions = {}
  sentMails = []
  Object.assign(config, {
    DEPLOYMENT_MODE: 'hosted',
    ALLOW_SIGNUP: true,
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_MONTHLY: 'price_month',
    STRIPE_PRICE_YEARLY: 'price_year',
    APP_URL: 'https://app.example.com'
  })
  stripe.setClient(fakeStripe())
  email.setTransport({ sendMail: async (message) => sentMails.push(message) })
})

afterEach(() => {
  Object.assign(config, original)
  stripe.setClient(null)
  email.setTransport(null)
})

after(() => db.destroy())

describe('signing up on the hosted service', () => {
  test('the bar waits for Checkout: only its settings and the billing page work', async () => {
    const { owner, user } = await signUpOwner()
    assert.strictEqual(user.subscriptionStatus, 'incomplete')

    await owner.get('/api/bar').expect(200)
    const blocked = await owner.get('/api/shifts?from=2026-10-12T00:00:00Z&to=2026-10-19T00:00:00Z').expect(402)
    assert.strictEqual(blocked.body.subscriptionStatus, 'incomplete')

    const page = await owner.get('/api/billing').expect(200)
    assert.strictEqual(page.body.status, 'incomplete')
    assert.strictEqual(page.body.canSubscribe, true)
    assert.strictEqual(page.body.hasCustomer, false)
  })

  test('Checkout asks for the card, with a 30-day trial, one bar and VAT', async () => {
    const { owner, organizationId } = await signUpOwner()
    const response = await owner.post('/api/billing/checkout').send({ interval: 'year' }).expect(200)
    assert.strictEqual(response.body.url, 'https://checkout.stripe.test/cs_test')

    const [params] = calls.checkout
    assert.strictEqual(params.mode, 'subscription')
    assert.deepStrictEqual(params.line_items, [{ price: 'price_year', quantity: 1 }])
    assert.strictEqual(params.subscription_data.trial_period_days, 30)
    assert.strictEqual(params.subscription_data.metadata.organizationId, String(organizationId))
    assert.strictEqual(params.client_reference_id, String(organizationId))
    assert.strictEqual(params.payment_method_collection, 'always')
    assert.deepStrictEqual(params.automatic_tax, { enabled: true })
    assert.deepStrictEqual(params.tax_id_collection, { enabled: true })
    assert.strictEqual(params.customer_email, 'maija@example.com')
    assert.strictEqual(params.success_url, 'https://app.example.com/?billing=success')

    await owner.post('/api/billing/checkout').send({ interval: 'week' }).expect(400)
  })

  test('completing Checkout starts the trial and opens the bar', async () => {
    const { owner, organizationId, user } = await signUpOwner()
    await completeCheckout(organizationId)

    const row = await organization(organizationId)
    assert.strictEqual(row.subscription_status, 'trialing')
    assert.strictEqual(row.stripe_customer_id, 'cus_maija')
    assert.strictEqual(row.stripe_subscription_id, 'sub_1')
    assert.strictEqual(row.billing_interval, 'month')
    assert.ok(row.trial_ends_at > new Date())

    await newShift(owner, user.employeeId).expect(201)
    assert.strictEqual((await owner.get('/api/me')).body.subscriptionStatus, 'trialing')
    // Already subscribed: changes go through the portal.
    await owner.post('/api/billing/checkout').send({ interval: 'month' }).expect(409)
  })
})

describe('webhooks', () => {
  test('a wrong signature is rejected', async () => {
    const { organizationId } = await signUpOwner()
    await sendEvent('customer.subscription.updated', subscription('sub_1', organizationId, 'active'), { secret: 'whsec_wrong' })
      .expect(400)
    assert.strictEqual((await organization(organizationId)).subscription_status, 'incomplete')
  })

  test('each event is handled once', async () => {
    const { organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    const invoice = { id: 'in_1', object: 'invoice', customer: 'cus_maija' }

    await sendEvent('invoice.payment_failed', invoice, { id: 'evt_same' }).expect(200)
    const again = await sendEvent('invoice.payment_failed', invoice, { id: 'evt_same' }).expect(200)
    assert.strictEqual(again.body.duplicate, true)
    // Another event about the same invoice doesn't email again either.
    await sendEvent('invoice.payment_failed', invoice).expect(200)
    assert.strictEqual(sentMails.filter((mail) => /Payment failed/.test(mail.subject)).length, 1)
  })

  test('events about an older subscription are ignored', async () => {
    const { organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    await sendEvent('customer.subscription.deleted', subscription('sub_old', organizationId, 'canceled')).expect(200)
    assert.strictEqual((await organization(organizationId)).subscription_status, 'trialing')
  })

  test('not used when self-hosting', async () => {
    config.DEPLOYMENT_MODE = 'self-hosted'
    await sendEvent('customer.subscription.updated', subscription('sub_1', 1, 'active')).expect(404)
  })
})

describe('when payment fails or the subscription ends', () => {
  test('past due: the bar works, and the owner is told', async () => {
    const { owner, organizationId, user } = await signUpOwner()
    await completeCheckout(organizationId)

    await sendEvent('customer.subscription.updated', subscription('sub_1', organizationId, 'past_due')).expect(200)
    await sendEvent('invoice.payment_failed', { id: 'in_1', object: 'invoice', customer: 'cus_maija' }).expect(200)

    assert.strictEqual((await organization(organizationId)).subscription_status, 'past_due')
    await newShift(owner, user.employeeId).expect(201)
    assert.strictEqual(sentMails.at(-1).to, 'maija@example.com')
    assert.match(sentMails.at(-1).text, /couldn't charge your card/)
  })

  test('ended: read-only for 14 days, then locked; deletion 90 days after the end', async () => {
    const { owner, organizationId, user } = await signUpOwner()
    await completeCheckout(organizationId)
    await newShift(owner, user.employeeId).expect(201)

    const endedAt = Math.floor(Date.now() / 1000)
    await sendEvent('customer.subscription.deleted', subscription('sub_1', organizationId, 'canceled', { ended_at: endedAt })).expect(200)

    let row = await organization(organizationId)
    assert.strictEqual(row.subscription_status, 'read_only')
    assert.strictEqual(row.ended_at.getTime(), endedAt * 1000)
    assert.strictEqual(row.scheduled_deletion_at.getTime(), endedAt * 1000 + 90 * DAY_MS)
    assert.match(sentMails.at(-1).subject, /now read-only/)

    // Everyone can still read; nobody can change anything.
    await owner.get('/api/shifts?from=2026-10-12T00:00:00Z&to=2026-10-19T00:00:00Z').expect(200)
    const blocked = await newShift(owner, user.employeeId).expect(402)
    assert.strictEqual(blocked.body.subscriptionStatus, 'read_only')

    // 13 days later still read-only, after 14 days locked.
    assert.strictEqual((await billing.runJobs(new Date(Date.now() + 13 * DAY_MS))).locked, 0)
    assert.strictEqual((await billing.runJobs(new Date(Date.now() + 14 * DAY_MS + 60000))).locked, 1)
    row = await organization(organizationId)
    assert.strictEqual(row.subscription_status, 'locked')
    assert.match(sentMails.at(-1).subject, /now locked/)

    await owner.get('/api/shifts?from=2026-10-12T00:00:00Z&to=2026-10-19T00:00:00Z').expect(402)
    await owner.get('/api/bar').expect(200)
    const page = await owner.get('/api/billing').expect(200)
    assert.strictEqual(page.body.status, 'locked')
    assert.strictEqual(page.body.canSubscribe, true)
    assert.strictEqual(new Date(page.body.lockedAt).getTime(), endedAt * 1000 + 14 * DAY_MS)
  })

  test('subscribing again: no new trial, and the end is forgotten', async () => {
    const { owner, organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    await sendEvent('customer.subscription.deleted', subscription('sub_1', organizationId, 'canceled')).expect(200)

    await owner.post('/api/billing/checkout').send({ interval: 'month' }).expect(200)
    const params = calls.checkout.at(-1)
    assert.strictEqual(params.subscription_data.trial_period_days, undefined)
    assert.strictEqual(params.customer, 'cus_maija')
    assert.strictEqual(params.customer_email, undefined)

    await sendEvent('customer.subscription.created', subscription('sub_2', organizationId, 'active')).expect(200)
    const row = await organization(organizationId)
    assert.strictEqual(row.subscription_status, 'active')
    assert.strictEqual(row.stripe_subscription_id, 'sub_2')
    assert.strictEqual(row.ended_at, null)
    assert.strictEqual(row.scheduled_deletion_at, null)
  })

  test('status changes go to the audit log', async () => {
    const { organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    const rows = await db('audit_log').where({ organization_id: organizationId, action: 'subscription.status' })
    assert.deepStrictEqual(rows.map((row) => row.details), [{ from: 'incomplete', to: 'trialing' }])
  })
})

describe('reminders', () => {
  test('the trial ends in 7 days: one email', async () => {
    const { organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    await db('organizations').where({ id: organizationId }).update({ trial_ends_at: new Date(Date.now() + 5 * DAY_MS) })

    assert.strictEqual((await billing.runJobs()).trialReminders, 1)
    assert.strictEqual((await billing.runJobs()).trialReminders, 0)
    assert.match(sentMails.at(-1).subject, /trial ends on/)
  })

  test('no trial reminder when the owner already cancelled', async () => {
    const { organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    await db('organizations').where({ id: organizationId })
      .update({ trial_ends_at: new Date(Date.now() + 5 * DAY_MS), cancel_at_period_end: true })
    assert.strictEqual((await billing.runJobs()).trialReminders, 0)
  })

  test('the data will be deleted in 7 days: one email, in the bar\'s language', async () => {
    const { organizationId } = await signUpOwner()
    await db('bars').where({ organization_id: organizationId }).update({ locale: 'fi' })
    await db('organizations').where({ id: organizationId })
      .update({ subscription_status: 'locked', ended_at: new Date(Date.now() - 85 * DAY_MS), scheduled_deletion_at: new Date(Date.now() + 5 * DAY_MS) })

    assert.strictEqual((await billing.runJobs()).deletionReminders, 1)
    assert.strictEqual((await billing.runJobs()).deletionReminders, 0)
    assert.match(sentMails.at(-1).subject, /tiedot poistetaan/)
  })
})

describe('the billing page', () => {
  test('only the owner manages billing', async () => {
    const { owner, organizationId } = await signUpOwner()
    await completeCheckout(organizationId)
    const [{ id: barId }] = await db('bars').where({ organization_id: organizationId })
    await insertUser('second', { barId, role: 'manager' })
    await insertUser('waiter', { barId, role: 'employee' })

    await (await loginAs('second')).get('/api/billing').expect(403)
    await (await loginAs('waiter')).post('/api/billing/portal').expect(403)
    await owner.get('/api/billing').expect(200)
  })

  test('the portal opens once there is a Stripe customer', async () => {
    const { owner, organizationId } = await signUpOwner()
    await owner.post('/api/billing/portal').expect(409)
    await completeCheckout(organizationId)

    const response = await owner.post('/api/billing/portal').expect(200)
    assert.strictEqual(response.body.url, 'https://billing.stripe.test/portal')
    assert.strictEqual(calls.portal[0].customer, 'cus_maija')
    assert.strictEqual(calls.portal[0].return_url, 'https://app.example.com')
  })

  test('self-hosted copies have no billing at all', async () => {
    config.DEPLOYMENT_MODE = 'self-hosted'
    const anna = await loginAs('anna')
    await anna.get('/api/billing').expect(404)
    // Bars without a subscription work fully.
    await anna.get('/api/employees/details').expect(200)
  })

  test('bars the platform admin created have full access on the hosted service', async () => {
    const anna = await loginAs('anna')
    const { body: me } = await anna.get('/api/me').expect(200)
    await newShift(anna, me.employeeId).expect(201)
  })
})

describe('number of bars', () => {
  test('a second bar adds one to the subscription', async () => {
    const { organizationId } = await signUpOwner()
    await completeCheckout(organizationId)

    await Bars.create({ name: 'Second Pub', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '02:00' }, db, { organizationId })
    await billing.syncBarCount(organizationId)
    assert.deepStrictEqual(calls.itemUpdates, [{ id: 'si_sub_1', quantity: 2, proration_behavior: 'create_prorations' }])
  })
})

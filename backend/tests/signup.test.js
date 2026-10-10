const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const config = require('../utils/config')
const email = require('../utils/email')
const turnstile = require('../utils/turnstile')
const { resetDb, loginAs } = require('./helper')

const api = supertest(app)

const SIGNUP = {
  name: ' Maija Owner ',
  email: ' Maija@Example.com ',
  password: 'maija-password',
  barName: ' Corner Pub ',
  country: 'fi',
  timezone: 'Europe/Helsinki',
  opensAt: '11:00',
  closesAt: '02:00',
  locale: 'fi'
}

let data
let sentMails
const settings = { ALLOW_SIGNUP: config.ALLOW_SIGNUP, DEPLOYMENT_MODE: config.DEPLOYMENT_MODE }

const enableEmail = () => {
  email.setTransport({ sendMail: async (message) => sentMails.push(message) })
}
const tokenIn = (text, name) => new URL(text.match(/https?:\/\/\S+/)[0]).searchParams.get(name)

// A new agent per sign-up, so the session cookie it gets is kept.
const signUp = (body = SIGNUP) => {
  const agent = supertest.agent(app)
  return { agent, request: agent.post('/api/signup').send(body) }
}

beforeEach(async () => {
  data = await resetDb()
  sentMails = []
  config.ALLOW_SIGNUP = true
})

afterEach(() => {
  Object.assign(config, settings)
  email.setTransport(null)
  turnstile.setVerifier(null)
})

after(() => db.destroy())

describe('sign-up', () => {
  test('creates the organization, the bar and its owner, and logs in', async () => {
    const { agent, request } = signUp()
    const response = await request.expect(201)

    assert.strictEqual(response.body.email, 'maija@example.com')
    assert.strictEqual(response.body.name, 'Maija Owner')
    assert.strictEqual(response.body.role, 'owner')
    assert.deepStrictEqual(response.body.groups, ['managerGroup'])
    assert.strictEqual(response.body.barName, 'Corner Pub')

    const bar = await agent.get('/api/bar').expect(200)
    assert.deepStrictEqual(
      { ...bar.body, id: undefined },
      { id: undefined, name: 'Corner Pub', timezone: 'Europe/Helsinki', opensAt: '11:00', closesAt: '02:00', locale: 'fi', clock24h: true, accentColor: '#863bff' }
    )
    const organization = await db('organizations').where({ id: response.body.organizationId }).first()
    assert.strictEqual(organization.name, 'Corner Pub')
    assert.strictEqual(organization.country, 'FI')

    // The owner is on the schedule as a manager.
    const employees = await agent.get('/api/employees').expect(200)
    assert.deepStrictEqual(employees.body.map(({ name, role }) => ({ name, role })), [{ name: 'Maija Owner', role: 'manager' }])
    assert.strictEqual(response.body.employeeId, employees.body[0].id)
  })

  test('self-hosted bars get no trial; hosted ones a 30-day trial', async () => {
    const selfHosted = await signUp().request.expect(201)
    const own = await db('organizations').where({ id: selfHosted.body.organizationId }).first()
    assert.strictEqual(own.subscription_status, null)
    assert.strictEqual(own.trial_ends_at, null)

    config.DEPLOYMENT_MODE = 'hosted'
    const hosted = await signUp({ ...SIGNUP, email: 'other@example.com' }).request.expect(201)
    const organization = await db('organizations').where({ id: hosted.body.organizationId }).first()
    assert.strictEqual(organization.subscription_status, 'trialing')
    // 30 calendar days: an hour more or less across a daylight saving change.
    const days = (organization.trial_ends_at - Date.now()) / (24 * 60 * 60 * 1000)
    assert.ok(days > 29.9 && days < 30.1, `trial of ${days} days`)
  })

  test('is not available when ALLOW_SIGNUP is off', async () => {
    config.ALLOW_SIGNUP = false
    await signUp().request.expect(404)
    assert.strictEqual(await db('users').where({ email: 'maija@example.com' }).first(), undefined)
  })

  test('app info tells the app whether sign-up is open', async () => {
    assert.strictEqual((await api.get('/api/app-info')).body.signupEnabled, true)
    config.ALLOW_SIGNUP = false
    assert.strictEqual((await api.get('/api/app-info')).body.signupEnabled, false)
  })

  test('invalid data is rejected and nothing is created', async () => {
    const invalid = [
      { name: '' },
      { email: 'not-an-email' },
      { password: 'short' },
      { barName: '' },
      { country: 'Finland' },
      { timezone: 'Mars/Base' },
      { opensAt: '25:00' },
      { opensAt: '10:00', closesAt: '10:00' },
      { locale: 'sv' }
    ]
    for (const change of invalid) {
      const response = await signUp({ ...SIGNUP, ...change }).request.expect(400)
      assert.ok(response.body.error, JSON.stringify(change))
    }
    assert.strictEqual(Number((await db('organizations').count('* as count').first()).count), 2)
  })

  test('an email already in use is refused', async () => {
    await signUp().request.expect(201)
    const response = await signUp({ ...SIGNUP, email: 'MAIJA@example.com' }).request.expect(409)
    assert.match(response.body.error, /already exists/)
  })

  test('the bot check must pass when Turnstile is on', async () => {
    turnstile.setVerifier(async (token) => token === 'human')
    await signUp().request.expect(400)
    await signUp({ ...SIGNUP, captchaToken: 'robot' }).request.expect(400)
    await signUp({ ...SIGNUP, captchaToken: 'human' }).request.expect(201)
  })
})

describe('email verification', () => {
  test('without email configured, the address is taken as verified', async () => {
    const response = await signUp().request.expect(201)
    assert.strictEqual(response.body.emailVerified, true)
    assert.strictEqual(sentMails.length, 0)
  })

  test('the link in the welcome email verifies the address, once', async () => {
    enableEmail()
    const { agent, request } = signUp()
    const response = await request.expect(201)
    assert.strictEqual(response.body.emailVerified, false)

    assert.strictEqual(sentMails.length, 1)
    assert.strictEqual(sentMails[0].to, 'maija@example.com')
    // In the bar's language.
    assert.match(sentMails[0].subject, /Vahvista/)
    const token = tokenIn(sentMails[0].text, 'verify')

    // The link works without logging in, e.g. on a phone.
    await api.post('/api/verify-email').send({ token }).expect(204)
    assert.strictEqual((await agent.get('/api/me')).body.emailVerified, true)
    await api.post('/api/verify-email').send({ token }).expect(404)
    await api.post('/api/verify-email').send({ token: 'made-up' }).expect(404)
  })

  test('inviting staff waits for the verification; adding without email does not', async () => {
    enableEmail()
    const { agent, request } = signUp()
    await request.expect(201)

    const invite = await agent.post('/api/employees').send({ name: 'Kalle', email: 'kalle@example.com' }).expect(403)
    assert.match(invite.body.error, /confirm your email/)
    await agent.post('/api/employees').send({ name: 'Liisa', username: 'liisa', password: 'liisa-password' }).expect(201)

    await api.post('/api/verify-email').send({ token: tokenIn(sentMails[0].text, 'verify') }).expect(204)
    await agent.post('/api/employees').send({ name: 'Kalle', email: 'kalle@example.com' }).expect(201)
  })

  test('a new link can be asked for; the old one stops working', async () => {
    enableEmail()
    const { agent, request } = signUp()
    await request.expect(201)

    await agent.post('/api/verify-email/resend').expect(202)
    assert.strictEqual(sentMails.length, 2)
    await api.post('/api/verify-email').send({ token: tokenIn(sentMails[0].text, 'verify') }).expect(404)
    await api.post('/api/verify-email').send({ token: tokenIn(sentMails[1].text, 'verify') }).expect(204)

    await agent.post('/api/verify-email/resend').expect(409)
    await api.post('/api/verify-email/resend').expect(401)
  })

  test('existing accounts with an email count as verified', async () => {
    const anna = await loginAs('anna')
    assert.strictEqual((await anna.get('/api/me')).body.emailVerified, true)
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'mikko@example.com' }).expect(200)
    assert.strictEqual((await (await loginAs('mikko')).get('/api/me')).body.emailVerified, true)
  })
})

describe('onboarding checklist', () => {
  test('a new bar starts with nothing done; each step is ticked from the data', async () => {
    const { agent, request } = signUp()
    const owner = (await request.expect(201)).body

    const steps = async () => (await agent.get('/api/bar/onboarding').expect(200)).body
    assert.deepStrictEqual(await steps(), { invite: false, plan: false, lock: false, dismissed: false })

    await agent.post('/api/employees').send({ name: 'Kalle', email: 'kalle@example.com' }).expect(201)
    await agent.post('/api/shifts')
      .send({ employeeId: owner.employeeId, start: '2026-10-12T09:00:00Z', end: '2026-10-12T17:00:00Z' })
      .expect(201)
    assert.deepStrictEqual(await steps(), { invite: true, plan: true, lock: false, dismissed: false })

    await agent.post('/api/schedule-weeks/2026-10-12/lock').expect(200)
    assert.deepStrictEqual(await steps(), { invite: true, plan: true, lock: true, dismissed: false })
  })

  test('can be dismissed, by managers only', async () => {
    const mikko = await loginAs('mikko')
    await mikko.get('/api/bar/onboarding').expect(403)
    await mikko.post('/api/bar/onboarding/dismiss').expect(403)

    const anna = await loginAs('anna')
    const response = await anna.post('/api/bar/onboarding/dismiss').expect(200)
    assert.strictEqual(response.body.dismissed, true)
    assert.strictEqual((await anna.get('/api/bar/onboarding')).body.dismissed, true)
    // Only this bar's checklist.
    assert.strictEqual((await (await loginAs('olli')).get('/api/bar/onboarding')).body.dismissed, false)
  })
})

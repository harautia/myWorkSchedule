const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const email = require('../utils/email')
const { resetDb, loginAs, PASSWORD } = require('./helper')

let data
let anna
let sentMails

// Email is off unless a test turns it on; sent messages are collected here.
const enableEmail = () => {
  email.setTransport({ sendMail: async (message) => sentMails.push(message) })
}
const tokenIn = (text, name) => new URL(text.match(/https?:\/\/\S+/)[0]).searchParams.get(name)

beforeEach(async () => {
  data = await resetDb()
  anna = await loginAs('anna')
  sentMails = []
})

afterEach(() => email.setTransport(null))

after(() => db.destroy())

const inviteKalle = () => anna.post('/api/employees').send({ name: ' Kalle ', email: ' Kalle@Example.com ' })

describe('logging in', () => {
  test('works with the email or the username', async () => {
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'Mikko@Example.com' }).expect(200)

    const byEmail = await supertest(app).post('/api/login').send({ login: 'mikko@example.com', password: PASSWORD }).expect(200)
    assert.strictEqual(byEmail.body.email, 'mikko@example.com')
    await supertest(app).post('/api/login').send({ login: 'MIKKO', password: PASSWORD }).expect(200)
    // The older field name still works.
    await supertest(app).post('/api/login').send({ username: 'mikko', password: PASSWORD }).expect(200)
    await supertest(app).post('/api/login').send({ login: 'mikko@example.com', password: 'wrong' }).expect(401)
  })
})

describe('inviting an employee', () => {
  test('without email configured, the manager gets the link to pass on', async () => {
    const response = await inviteKalle().expect(201)

    assert.strictEqual(response.body.name, 'Kalle')
    assert.strictEqual(response.body.account, null)
    assert.strictEqual(response.body.invite.email, 'kalle@example.com')
    assert.strictEqual(response.body.inviteSent.sent, false)
    assert.match(response.body.inviteSent.url, /\/\?invite=/)
    assert.deepStrictEqual(sentMails, [])
  })

  test('the invited person sets a password, is logged in and linked to the schedule', async () => {
    const created = (await inviteKalle().expect(201)).body
    const token = new URL(created.inviteSent.url).searchParams.get('invite')
    const kalle = supertest.agent(app)

    const greeting = await kalle.get(`/api/invites/${token}`).expect(200)
    assert.deepStrictEqual(greeting.body, { name: 'Kalle', email: 'kalle@example.com', barName: 'Own Bar', locale: 'en' })

    await kalle.post(`/api/invites/${token}/accept`).send({ password: 'short' }).expect(400)
    const accepted = await kalle.post(`/api/invites/${token}/accept`).send({ password: 'kalle-password' }).expect(201)
    assert.strictEqual(accepted.body.email, 'kalle@example.com')
    assert.strictEqual(accepted.body.employeeId, created.id)
    assert.deepStrictEqual(accepted.body.groups, ['employeeGroup'])
    await kalle.get('/api/me').expect(200)

    // The link works only once; the account then logs in normally.
    await supertest(app).get(`/api/invites/${token}`).expect(404)
    await supertest(app).post(`/api/invites/${token}/accept`).send({ password: 'other-password' }).expect(404)
    await supertest(app).post('/api/login').send({ login: 'kalle@example.com', password: 'kalle-password' }).expect(200)

    const row = (await anna.get('/api/employees/details')).body.find((employee) => employee.id === created.id)
    assert.strictEqual(row.account.email, 'kalle@example.com')
    assert.strictEqual(row.invite, null)
  })

  test('with email configured, the invitation is emailed in the bar\'s language', async () => {
    enableEmail()
    await db('bars').where({ id: data.own.id }).update({ locale: 'fi' })

    const response = await inviteKalle().expect(201)

    assert.deepStrictEqual(response.body.inviteSent, { email: 'kalle@example.com', sent: true })
    assert.strictEqual(sentMails.length, 1)
    assert.strictEqual(sentMails[0].to, 'kalle@example.com')
    assert.match(sentMails[0].subject, /Kutsu: Own Bar/)
    const token = tokenIn(sentMails[0].text, 'invite')
    await supertest(app).get(`/api/invites/${token}`).expect(200)
  })

  test('an expired invitation doesn\'t work', async () => {
    const token = new URL((await inviteKalle()).body.inviteSent.url).searchParams.get('invite')
    await db('invites').update({ expires_at: db.raw("now() - interval '1 minute'") })

    await supertest(app).get(`/api/invites/${token}`).expect(404)
    await supertest(app).post(`/api/invites/${token}/accept`).send({ password: 'kalle-password' }).expect(404)
  })

  test('an email already in use is refused, also if taken before accepting', async () => {
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'mikko@example.com' }).expect(200)
    await anna.post('/api/employees').send({ name: 'Other', email: 'mikko@example.com' }).expect(409)

    const token = new URL((await inviteKalle()).body.inviteSent.url).searchParams.get('invite')
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'kalle@example.com' }).expect(200)
    await supertest(app).post(`/api/invites/${token}/accept`).send({ password: 'kalle-password' }).expect(409)
  })

  test('a new invitation replaces the old one', async () => {
    const created = (await inviteKalle()).body
    const first = new URL(created.inviteSent.url).searchParams.get('invite')

    const again = await anna.post(`/api/employees/${created.id}/invite`).send({}).expect(200)
    assert.strictEqual(again.body.email, 'kalle@example.com')
    const second = new URL(again.body.url).searchParams.get('invite')

    await supertest(app).get(`/api/invites/${first}`).expect(404)
    await supertest(app).get(`/api/invites/${second}`).expect(200)
  })

  test('an employee without a login, e.g. from before invitations, can be invited', async () => {
    const [liisa] = await db('employees')
      .insert({ bar_id: data.own.id, name: 'Liisa', role: 'waiter', color: '#0ca678' })
      .returning('*')

    await anna.post(`/api/employees/${liisa.id}/invite`).send({}).expect(400)
    const response = await anna.post(`/api/employees/${liisa.id}/invite`).send({ email: 'liisa@example.com' }).expect(200)
    assert.match(response.body.url, /invite=/)
  })

  test('limits', async () => {
    // Someone who already has an account isn't invited.
    await anna.post(`/api/employees/${data.mikko.id}/invite`).send({ email: 'm@example.com' }).expect(409)
    // Invalid input.
    await anna.post('/api/employees').send({ name: 'X', email: 'not-an-email' }).expect(400)
    await anna.post('/api/employees').send({ name: ' ', email: 'x@example.com' }).expect(400)
    // Employees can't invite; other bars' employees are not found.
    const mikko = await loginAs('mikko')
    await mikko.post('/api/employees').send({ name: 'X', email: 'x@example.com' }).expect(403)
    await anna.post(`/api/employees/${data.olli.id}/invite`).send({ email: 'x@example.com' }).expect(404)
    // Made-up tokens.
    await supertest(app).get('/api/invites/made-up-token').expect(404)
  })
})

describe('forgotten password', () => {
  const requestReset = (address) => supertest(app).post('/api/password-reset').send({ email: address })

  test('a reset link is emailed and sets a new password, ending old sessions', async () => {
    enableEmail()
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'mikko@example.com' }).expect(200)
    const oldSession = await loginAs('mikko')

    await requestReset('Mikko@Example.com').expect(202)
    assert.strictEqual(sentMails.length, 1)
    assert.strictEqual(sentMails[0].to, 'mikko@example.com')
    const token = tokenIn(sentMails[0].text, 'reset')

    await supertest(app).post('/api/password-reset/confirm').send({ token, password: 'short' }).expect(400)
    await supertest(app).post('/api/password-reset/confirm').send({ token, password: 'brand-new-password' }).expect(204)

    await oldSession.get('/api/me').expect(401)
    await supertest(app).post('/api/login').send({ login: 'mikko@example.com', password: 'brand-new-password' }).expect(200)
    // Only once.
    await supertest(app).post('/api/password-reset/confirm').send({ token, password: 'another-password' }).expect(404)
  })

  test('the answer doesn\'t reveal whether an account exists', async () => {
    enableEmail()
    await requestReset('nobody@example.com').expect(202)
    await requestReset('not an email').expect(202)
    assert.deepStrictEqual(sentMails, [])
  })

  test('without email configured nothing is sent', async () => {
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'mikko@example.com' }).expect(200)
    await requestReset('mikko@example.com').expect(202)
    assert.deepStrictEqual(sentMails, [])
  })

  test('an expired or made-up link doesn\'t work', async () => {
    enableEmail()
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'mikko@example.com' }).expect(200)
    await requestReset('mikko@example.com')
    const token = tokenIn(sentMails[0].text, 'reset')
    await db('password_resets').update({ expires_at: db.raw("now() - interval '1 minute'") })

    await supertest(app).post('/api/password-reset/confirm').send({ token, password: 'brand-new-password' }).expect(404)
    await supertest(app).post('/api/password-reset/confirm').send({ token: 'made-up', password: 'brand-new-password' }).expect(404)
  })
})

describe('emails on accounts', () => {
  test('a manager changes an employee\'s email; the same email can\'t be used twice', async () => {
    await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'bad' }).expect(400)
    const response = await anna.put(`/api/employees/${data.mikko.id}`).send({ email: 'Mikko@Example.com' }).expect(200)
    assert.strictEqual(response.body.account.email, 'mikko@example.com')

    const admin = await loginAs('admin')
    await admin.put(`/api/admin/bars/${data.own.id}/managers/${(await db('users').where({ username: 'anna' }).first()).id}`)
      .send({ email: 'mikko@example.com' })
      .expect(409)
  })

  test('an admin creates a manager with an email, who can log in with it', async () => {
    const admin = await loginAs('admin')
    await admin.post(`/api/admin/bars/${data.own.id}/managers`)
      .send({ username: 'kaisa', name: 'Kaisa', password: 'kaisa-password', email: 'kaisa@example.com' })
      .expect(201)
    await supertest(app).post('/api/login').send({ login: 'kaisa@example.com', password: 'kaisa-password' }).expect(200)
  })

  test('app info tells whether email is configured', async () => {
    assert.strictEqual((await supertest(app).get('/api/app-info')).body.emailEnabled, false)
    enableEmail()
    assert.strictEqual((await supertest(app).get('/api/app-info')).body.emailEnabled, true)
  })
})

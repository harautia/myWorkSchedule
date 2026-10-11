// Exporting and deleting data (spec DATA-01-04).
const { test, describe, beforeEach, afterEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const config = require('../utils/config')
const deletion = require('../utils/deletion')
const email = require('../utils/email')
const stripe = require('../utils/stripe')
const { csvField } = require('../utils/dataExport')
const { resetDb, loginAs, insertUser, PASSWORD } = require('./helper')

const api = supertest(app)
const DAY_MS = 24 * 60 * 60 * 1000
const original = { ...config }

let data
let anna
let sentMails

beforeEach(async () => {
  data = await resetDb()
  anna = await loginAs('anna')
  sentMails = []
  email.setTransport({ sendMail: async (message) => sentMails.push(message) })
})

afterEach(() => {
  Object.assign(config, original)
  email.setTransport(null)
  stripe.setClient(null)
})

after(() => db.destroy())

describe('export', () => {
  test('the owner downloads everything as JSON, without passwords', async () => {
    const response = await anna.get('/api/bar/export').expect(200)
    assert.match(response.headers['content-disposition'], /attachment; filename="own-bar-\d{4}-\d{2}-\d{2}\.json"/)

    const body = response.body
    assert.strictEqual(body.bar.name, 'Own Bar')
    assert.deepStrictEqual(body.employees.map((employee) => employee.name), ['Anna', 'Mikko'])
    assert.deepStrictEqual(body.accounts.map((account) => `${account.name}:${account.role}`), ['anna:owner', 'mikko:employee'])
    assert.deepStrictEqual(body.shifts.map((shift) => shift.id), [data.ownShift.id])
    // Nothing from the other bar, and no secrets.
    assert.doesNotMatch(JSON.stringify(body), /Olli|password|token/i)

    const [logged] = await db('audit_log').where({ action: 'bar.export' })
    assert.strictEqual(logged.bar_id, data.own.id)
  })

  test('shifts as CSV, in the bar\'s local time', async () => {
    await db('employees').where({ id: data.mikko.id }).update({ name: '=HYPERLINK("x")' })
    await db('shifts').insert({ bar_id: data.own.id, employee_id: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:30:00Z' })

    const response = await anna.get('/api/bar/export?format=csv').expect(200)
    assert.match(response.headers['content-type'], /text\/csv/)
    const lines = response.text.replace(String.fromCharCode(0xfeff), '').trim().split('\r\n')
    assert.deepStrictEqual(lines, [
      'date,start,end,hours,employee,role',
      // 07:00 UTC is 10:00 in Helsinki (summer time).
      '2026-09-21,10:00,18:00,8.00,Anna,manager',
      // A name that looks like a formula is defused.
      '2026-09-22,18:00,02:30,8.50,"\'=HYPERLINK(""x"")",waiter'
    ])
  })

  test('CSV fields are quoted when needed', () => {
    assert.strictEqual(csvField('plain'), 'plain')
    assert.strictEqual(csvField('a,b'), '"a,b"')
    assert.strictEqual(csvField('@sum'), '\'@sum')
    assert.strictEqual(csvField(null), '')
  })

  test('only the owner exports', async () => {
    await insertUser('second', { barId: data.own.id, role: 'manager' })
    await (await loginAs('second')).get('/api/bar/export').expect(403)
    await (await loginAs('mikko')).get('/api/bar/export').expect(403)
  })

  test('a locked bar can still be exported', async () => {
    config.DEPLOYMENT_MODE = 'hosted'
    await db('organizations').where({ id: data.own.organization_id }).update({ subscription_status: 'locked' })
    await anna.get('/api/employees').expect(402)
    await anna.get('/api/bar/export').expect(200)
  })
})

describe('scheduled deletion', () => {
  test('the owner schedules it 30 days ahead; the bar keeps working; it can be undone', async () => {
    await db('users').where({ username: 'anna' }).update({ email: 'anna@example.com' })
    await anna.post('/api/bar/deletion').send({ confirmName: 'Wrong Bar' }).expect(400)
    const response = await anna.post('/api/bar/deletion').send({ confirmName: 'Own Bar' }).expect(200)

    const days = (new Date(response.body.scheduledDeletionAt) - Date.now()) / DAY_MS
    assert.ok(days > 29.9 && days <= 30, `${days} days`)
    assert.match(sentMails.at(-1).subject, /Own Bar will be deleted on/)
    await anna.get('/api/employees').expect(200)
    await anna.post('/api/bar/deletion').send({ confirmName: 'Own Bar' }).expect(409)

    const undone = await anna.delete('/api/bar/deletion').expect(200)
    assert.strictEqual(undone.body.scheduledDeletionAt, null)
    const actions = await db('audit_log').where({ bar_id: data.own.id }).orderBy('id').pluck('action')
    assert.deepStrictEqual(actions, ['bar.deletion_scheduled', 'bar.deletion_cancelled'])
  })

  test('only the owner schedules it', async () => {
    await (await loginAs('mikko')).post('/api/bar/deletion').send({ confirmName: 'Own Bar' }).expect(403)
  })

  test('the hourly job deletes the bar once the date has passed', async () => {
    await anna.post('/api/bar/deletion').send({ confirmName: 'Own Bar' }).expect(200)

    assert.strictEqual((await deletion.runJobs(new Date(Date.now() + 29 * DAY_MS))).barsDeleted, 0)
    assert.strictEqual((await deletion.runJobs(new Date(Date.now() + 31 * DAY_MS))).barsDeleted, 1)

    assert.strictEqual(await db('bars').where({ id: data.own.id }).first(), undefined)
    assert.strictEqual(await db('organizations').where({ id: data.own.organization_id }).first(), undefined)
    await api.post('/api/login').send({ username: 'anna', password: PASSWORD }).expect(401)
    assert.ok(await db('bars').where({ id: data.other.id }).first())
  })

  test('the job also deletes organizations whose retention period is over', async () => {
    await db('organizations').where({ id: data.other.organization_id })
      .update({ subscription_status: 'locked', scheduled_deletion_at: new Date(Date.now() - 1000) })
    assert.strictEqual((await deletion.runJobs()).barsDeleted, 1)
    assert.strictEqual(await db('bars').where({ id: data.other.id }).first(), undefined)
    assert.ok(await db('bars').where({ id: data.own.id }).first())
  })

  test('the admin schedules, undoes, or deletes at once', async () => {
    const admin = await loginAs('admin')
    const scheduled = await admin.delete(`/api/admin/bars/${data.own.id}`).expect(200)
    assert.ok(scheduled.body.scheduledDeletionAt)
    const undone = await admin.delete(`/api/admin/bars/${data.own.id}/deletion`).expect(200)
    assert.strictEqual(undone.body.scheduledDeletionAt, null)

    await admin.delete(`/api/admin/bars/${data.own.id}?now=true`).expect(204)
    assert.strictEqual(await db('bars').where({ id: data.own.id }).first(), undefined)
  })

  test('hosted: the subscription ends with the last bar, and continues when undone', async () => {
    const updates = []
    stripe.setClient({
      subscriptions: { update: async (id, params) => updates.push({ id, ...params }) },
      subscriptionItems: { update: async () => {} }
    })
    config.DEPLOYMENT_MODE = 'hosted'
    await db('organizations').where({ id: data.own.organization_id })
      .update({ subscription_status: 'active', stripe_subscription_id: 'sub_own', stripe_customer_id: 'cus_own' })

    await anna.post('/api/bar/deletion').send({ confirmName: 'Own Bar' }).expect(200)
    await anna.delete('/api/bar/deletion').expect(200)
    assert.deepStrictEqual(updates, [
      { id: 'sub_own', cancel_at_period_end: true },
      { id: 'sub_own', cancel_at_period_end: false }
    ])
  })
})

describe('erasing a person (GDPR)', () => {
  test('a manager anonymises an employee: account gone, shifts kept', async () => {
    await db('shifts').insert({ bar_id: data.own.id, employee_id: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
    const response = await anna.post(`/api/employees/${data.mikko.id}/anonymise`).expect(200)

    assert.strictEqual(response.body.name, `Former employee ${data.mikko.id}`)
    assert.strictEqual(response.body.anonymised, true)
    assert.strictEqual(response.body.account, null)
    await api.post('/api/login').send({ username: 'mikko', password: PASSWORD }).expect(401)
    assert.strictEqual((await db('shifts').where({ employee_id: data.mikko.id })).length, 1)

    await anna.post(`/api/employees/${data.mikko.id}/anonymise`).expect(409)
    await anna.post(`/api/employees/${data.mikko.id}/invite`).send({ email: 'mikko@example.com' }).expect(409)
    // Managers' accounts are the admin's to handle.
    await anna.post(`/api/employees/${data.anna.id}/anonymise`).expect(403)
  })

  test('the name follows the bar\'s language', async () => {
    await db('bars').where({ id: data.own.id }).update({ locale: 'fi' })
    const response = await anna.post(`/api/employees/${data.mikko.id}/anonymise`).expect(200)
    assert.strictEqual(response.body.name, `Entinen työntekijä ${data.mikko.id}`)
  })

  test('the admin finds a person by email and exports their data', async () => {
    await db('users').where({ username: 'mikko' }).update({ email: 'mikko@example.com' })
    await db('shifts').insert({ bar_id: data.own.id, employee_id: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
    const admin = await loginAs('admin')

    await admin.get('/api/admin/people?email=nobody@example.com').expect(404)
    const person = await admin.get('/api/admin/people?email=Mikko@Example.com').expect(200)
    assert.deepStrictEqual(person.body.bars, [{ id: data.own.id, name: 'Own Bar', role: 'employee' }])

    const exported = await admin.get(`/api/admin/people/${person.body.id}/export`).expect(200)
    assert.strictEqual(exported.body.account.email, 'mikko@example.com')
    assert.strictEqual(exported.body.shifts.length, 1)
    assert.doesNotMatch(JSON.stringify(exported.body), /password/i)
  })

  test('the admin erases a person everywhere; the log keeps no name', async () => {
    await db('users').where({ username: 'mikko' }).update({ email: 'mikko@example.com' })
    const admin = await loginAs('admin')
    const { body: person } = await admin.get('/api/admin/people?email=mikko@example.com').expect(200)

    await admin.post(`/api/admin/people/${person.id}/erase`).expect(204)
    assert.strictEqual(await db('users').where({ id: person.id }).first(), undefined)
    const employee = await db('employees').where({ id: data.mikko.id }).first()
    assert.match(employee.name, /^Former employee/)
    const [logged] = await db('audit_log').where({ action: 'person.erase' })
    assert.doesNotMatch(JSON.stringify(logged), /mikko/i)
  })

  test('a bar\'s last manager and platform admins can\'t be erased', async () => {
    const admin = await loginAs('admin')
    const annaId = (await db('users').where({ username: 'anna' }).first()).id
    const adminId = (await db('users').where({ username: 'admin' }).first()).id
    const refused = await admin.post(`/api/admin/people/${annaId}/erase`).expect(409)
    assert.match(refused.body.error, /last manager/)
    await admin.post(`/api/admin/people/${adminId}/erase`).expect(409)
    await anna.post(`/api/admin/people/${annaId}/erase`).expect(403)
  })
})

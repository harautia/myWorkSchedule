// The platform admin's tools: the organizations list (ADM-01) and support
// mode (ADM-02).
const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const db = require('../db/db')
const { resetDb, loginAs } = require('./helper')

let data
let admin

beforeEach(async () => {
  data = await resetDb()
  admin = await loginAs('admin')
})

after(() => db.destroy())

describe('organizations list', () => {
  test('shows each organization with its bars, status and activity', async () => {
    await loginAs('anna')
    await loginAs('mikko')
    const response = await admin.get('/api/admin/organizations').expect(200)

    const own = response.body.find((organization) => organization.name === 'Own Bar')
    assert.deepStrictEqual(own.bars, [{ id: data.own.id, name: 'Own Bar' }])
    assert.strictEqual(own.subscriptionStatus, null)
    // Anna and Mikko logged in just now.
    assert.strictEqual(own.activeUsers, 2)
    assert.ok(Date.now() - new Date(own.lastActiveAt).getTime() < 60000)

    const other = response.body.find((organization) => organization.name === 'Other Bar')
    assert.strictEqual(other.activeUsers, 0)
    assert.strictEqual(other.lastActiveAt, null)
  })

  test('can be searched and filtered by status', async () => {
    await db('organizations').where({ name: 'Other Bar' }).update({ subscription_status: 'past_due' })

    const searched = await admin.get('/api/admin/organizations?search=own').expect(200)
    assert.deepStrictEqual(searched.body.map((organization) => organization.name), ['Own Bar'])

    const pastDue = await admin.get('/api/admin/organizations?status=past_due').expect(200)
    assert.deepStrictEqual(pastDue.body.map((organization) => organization.name), ['Other Bar'])
    const none = await admin.get('/api/admin/organizations?status=none').expect(200)
    assert.deepStrictEqual(none.body.map((organization) => organization.name), ['Own Bar'])

    // Wildcards are taken literally.
    assert.deepStrictEqual((await admin.get('/api/admin/organizations?search=%25')).body, [])
  })

  test('is for admins only', async () => {
    await (await loginAs('anna')).get('/api/admin/organizations').expect(403)
  })
})

describe('support mode', () => {
  test('needs a reason, which goes to the audit log', async () => {
    await admin.post(`/api/admin/bars/${data.own.id}/support`).send({}).expect(400)
    await admin.post(`/api/admin/bars/${data.own.id}/support`).send({ reason: 'Ticket 42: shifts missing' }).expect(204)

    const log = await admin.get(`/api/admin/bars/${data.own.id}/audit`).expect(200)
    assert.strictEqual(log.body[0].action, 'support.open')
    assert.strictEqual(log.body[0].actorName, 'admin')
    assert.deepStrictEqual(log.body[0].details, { reason: 'Ticket 42: shifts missing' })
  })

  test('shows the bar as its managers see it', async () => {
    await admin.post(`/api/admin/bars/${data.own.id}/support`).send({ reason: 'Ticket 42' }).expect(204)

    const me = await admin.get('/api/me').expect(200)
    assert.strictEqual(me.body.supportMode, true)
    assert.strictEqual(me.body.barId, data.own.id)
    assert.strictEqual(me.body.barName, 'Own Bar')
    assert.deepStrictEqual(me.body.groups, ['adminGroup', 'managerGroup'])

    const employees = await admin.get('/api/employees/details').expect(200)
    assert.deepStrictEqual(employees.body.map((employee) => employee.name), ['Anna', 'Mikko'])
    // The admin pages still work.
    await admin.get('/api/admin/bars').expect(200)
  })

  test('is read-only', async () => {
    await admin.post(`/api/admin/bars/${data.own.id}/support`).send({ reason: 'Ticket 42' }).expect(204)

    const response = await admin.post('/api/shifts')
      .send({ employeeId: data.anna.id, start: '2026-10-12T09:00:00Z', end: '2026-10-12T17:00:00Z' })
      .expect(403)
    assert.match(response.body.error, /read-only/)
    await admin.put('/api/bar').send({ name: 'Hacked' }).expect(403)
    await admin.delete(`/api/employees/${data.mikko.id}`).expect(403)
    assert.strictEqual((await db('bars').where({ id: data.own.id }).first()).name, 'Own Bar')
  })

  test('leaving ends it and is logged', async () => {
    await admin.post(`/api/admin/bars/${data.own.id}/support`).send({ reason: 'Ticket 42' }).expect(204)
    await admin.delete('/api/admin/support').expect(204)

    const me = await admin.get('/api/me').expect(200)
    assert.strictEqual(me.body.supportMode, undefined)
    assert.strictEqual(me.body.barId, null)
    await admin.get('/api/employees/details').expect(403)

    const log = await admin.get(`/api/admin/bars/${data.own.id}/audit`).expect(200)
    assert.deepStrictEqual(log.body.map((entry) => entry.action), ['support.close', 'support.open'])
  })

  test('the support cookie does nothing for anyone but that admin', async () => {
    await admin.post(`/api/admin/bars/${data.own.id}/support`).send({ reason: 'Ticket 42' }).expect(204)
    const cookie = (await admin.get('/api/me')).request.cookies

    const mikko = await loginAs('mikko')
    mikko.jar.setCookie(cookie.split('; ').find((part) => part.startsWith('support=')))
    const me = await mikko.get('/api/me').expect(200)
    assert.strictEqual(me.body.supportMode, undefined)
    assert.deepStrictEqual(me.body.groups, ['employeeGroup'])
  })

  test('only admins can open it', async () => {
    await (await loginAs('anna')).post(`/api/admin/bars/${data.other.id}/support`).send({ reason: 'x'.repeat(10) }).expect(403)
  })
})

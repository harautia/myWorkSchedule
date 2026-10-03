const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { resetDb, loginAs, PASSWORD } = require('./helper')

const api = supertest(app)

let data

beforeEach(async () => {
  data = await resetDb()
})

after(() => db.destroy())

describe('login', () => {
  test('returns the user with groups and bar, and sets an httpOnly cookie', async () => {
    const response = await api.post('/api/login').send({ username: 'Anna', password: PASSWORD }).expect(200)

    assert.strictEqual(response.body.username, 'anna')
    assert.deepStrictEqual(response.body.groups, ['managerGroup'])
    assert.strictEqual(response.body.barId, data.own.id)
    assert.strictEqual(response.body.barName, 'Own Bar')
    assert.strictEqual(response.body.password_hash, undefined)
    assert.match(response.headers['set-cookie'][0], /HttpOnly/)
  })

  test('a wrong password or unknown user is rejected', async () => {
    await api.post('/api/login').send({ username: 'anna', password: 'wrong' }).expect(401)
    await api.post('/api/login').send({ username: 'nobody', password: PASSWORD }).expect(401)
  })

  test('me returns the logged-in user, and 401 after logout', async () => {
    const agent = await loginAs('mikko')
    const me = await agent.get('/api/me').expect(200)
    assert.strictEqual(me.body.employeeId, data.mikko.id)

    await agent.post('/api/logout').expect(200)
    await agent.get('/api/me').expect(401)
  })

  test('bar data requires login', async () => {
    await api.get('/api/employees').expect(401)
    await api.get('/api/shifts').query({ from: '2026-09-21T00:00:00Z', to: '2026-09-28T00:00:00Z' }).expect(401)
    await api.get('/api/admin/bars').expect(401)
  })

  test('a forged cookie is rejected', async () => {
    await api.get('/api/me').set('Cookie', 'session=not-a-valid-token').expect(401)
  })
})

describe('adminGroup', () => {
  test('sees all bars with counts', async () => {
    const admin = await loginAs('admin')
    const response = await admin.get('/api/admin/bars').expect(200)

    assert.deepStrictEqual(
      response.body.map(({ name, employeeCount, userCount }) => ({ name, employeeCount, userCount })),
      [
        { name: 'Other Bar', employeeCount: 1, userCount: 1 },
        { name: 'Own Bar', employeeCount: 2, userCount: 2 }
      ]
    )
  })

  test('has no bar of its own, so bar data is forbidden', async () => {
    const admin = await loginAs('admin')
    await admin.get('/api/employees').expect(403)
  })
})

describe('managerGroup', () => {
  test('cannot see the admin bar list', async () => {
    const anna = await loginAs('anna')
    await anna.get('/api/admin/bars').expect(403)
  })

  test('sees own bar\'s employees with their accounts', async () => {
    const anna = await loginAs('anna')
    const response = await anna.get('/api/employees/details').expect(200)

    assert.deepStrictEqual(
      response.body.map(({ name, account }) => ({ name, account })),
      [
        { name: 'Anna', account: { username: 'anna', groups: ['managerGroup'] } },
        { name: 'Mikko', account: { username: 'mikko', groups: ['employeeGroup'] } }
      ]
    )
  })
})

describe('employeeGroup', () => {
  // Employees only see locked weeks; lock the fixture week in both bars.
  beforeEach(async () => {
    await (await loginAs('anna')).post('/api/schedule-weeks/2026-09-21/lock').expect(200)
    await (await loginAs('olli')).post('/api/schedule-weeks/2026-09-21/lock').expect(200)
  })

  test('sees the bar\'s schedule and employees', async () => {
    const mikko = await loginAs('mikko')
    const shifts = await mikko
      .get('/api/shifts')
      .query({ from: '2026-09-21T00:00:00Z', to: '2026-09-28T00:00:00Z' })
      .expect(200)
    assert.deepStrictEqual(shifts.body.map((s) => s.id), [data.ownShift.id])

    const employees = await mikko.get('/api/employees').expect(200)
    assert.deepStrictEqual(employees.body.map((e) => e.name), ['Anna', 'Mikko'])
    await mikko.get('/api/day-orders').expect(200)
  })

  test('sees only their own bar, whatever the request says', async () => {
    const mikko = await loginAs('mikko')

    const bar = await mikko.get('/api/bar').query({ barId: data.other.id }).expect(200)
    assert.strictEqual(bar.body.name, 'Own Bar')
    // Other Bar has a saved day order and a shift in this range; neither is shown.
    const orders = await mikko.get('/api/day-orders').query({ barId: data.other.id }).expect(200)
    assert.deepStrictEqual(orders.body, {})
    const shifts = await mikko
      .get('/api/shifts')
      .query({ from: '2026-09-21T00:00:00Z', to: '2026-09-28T00:00:00Z', barId: data.other.id })
      .expect(200)
    assert.deepStrictEqual(shifts.body.map((s) => s.id), [data.ownShift.id])
  })

  test('cannot see employee details or change the schedule', async () => {
    const mikko = await loginAs('mikko')
    await mikko.get('/api/employees/details').expect(403)
    await mikko.get('/api/admin/bars').expect(403)
    await mikko
      .post('/api/shifts')
      .send({ employeeId: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
      .expect(403)
    await mikko.put(`/api/shifts/${data.ownShift.id}`).send({ start: '2026-09-21T09:00:00Z' }).expect(403)
    await mikko.delete(`/api/shifts/${data.ownShift.id}`).expect(403)
    await mikko.put('/api/day-orders/2026-09-21').send({ order: [data.mikko.id] }).expect(403)
  })
})

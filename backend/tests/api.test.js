const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { resetDb } = require('./helper')

const api = supertest(app)
const WEEK = { from: '2026-09-21T00:00:00Z', to: '2026-09-28T00:00:00Z' }

let data

beforeEach(async () => {
  data = await resetDb()
})

after(() => db.destroy())

describe('bar', () => {
  test('returns the current bar with its opening hours', async () => {
    const response = await api.get('/api/bar').expect(200)

    assert.deepStrictEqual(response.body, {
      id: data.own.id,
      name: 'Own Bar',
      timezone: 'Europe/Helsinki',
      opensAt: '10:00',
      closesAt: '04:00'
    })
  })
})

describe('employees', () => {
  test('only the current bar\'s employees are returned', async () => {
    const response = await api.get('/api/employees').expect(200)

    assert.deepStrictEqual(response.body.map((e) => e.name), ['Anna', 'Mikko'])
  })
})

describe('shifts', () => {
  test('lists only the current bar\'s shifts in the range', async () => {
    const response = await api.get('/api/shifts').query(WEEK).expect(200)

    assert.deepStrictEqual(response.body, [
      { id: data.ownShift.id, employeeId: data.anna.id, start: '2026-09-21T07:00:00.000Z', end: '2026-09-21T15:00:00.000Z' }
    ])
  })

  test('range is required', async () => {
    await api.get('/api/shifts').expect(400)
  })

  test('a shift can be created', async () => {
    const response = await api
      .post('/api/shifts')
      .send({ employeeId: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
      .expect(201)

    assert.strictEqual(response.body.employeeId, data.mikko.id)
    const listed = await api.get('/api/shifts').query(WEEK)
    assert.strictEqual(listed.body.length, 2)
  })

  test('a shift cannot be created for another bar\'s employee', async () => {
    const response = await api
      .post('/api/shifts')
      .send({ employeeId: data.olli.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
      .expect(400)

    assert.strictEqual(response.body.error, 'unknown employee')
  })

  test('end must be after start', async () => {
    await api
      .post('/api/shifts')
      .send({ employeeId: data.anna.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T15:00:00Z' })
      .expect(400)
  })

  test('moving a shift updates its times', async () => {
    const response = await api
      .put(`/api/shifts/${data.ownShift.id}`)
      .send({ start: '2026-09-21T09:00:00.000Z', end: '2026-09-21T17:00:00.000Z' })
      .expect(200)

    assert.strictEqual(response.body.start, '2026-09-21T09:00:00.000Z')
    assert.strictEqual(response.body.end, '2026-09-21T17:00:00.000Z')
  })

  test('another bar\'s shift cannot be updated or deleted', async () => {
    await api
      .put(`/api/shifts/${data.otherShift.id}`)
      .send({ start: '2026-09-21T09:00:00Z' })
      .expect(404)
    await api.delete(`/api/shifts/${data.otherShift.id}`).expect(404)

    const row = await db('shifts').where({ id: data.otherShift.id }).first()
    assert.strictEqual(row.start.toISOString(), '2026-09-21T08:00:00.000Z')
  })

  test('a non-numeric id is not found', async () => {
    await api.put('/api/shifts/abc').send({}).expect(404)
  })

  test('a shift can be deleted', async () => {
    await api.delete(`/api/shifts/${data.ownShift.id}`).expect(204)

    const listed = await api.get('/api/shifts').query(WEEK)
    assert.strictEqual(listed.body.length, 0)
  })
})

describe('day orders', () => {
  test('another bar\'s day orders are not returned', async () => {
    const response = await api.get('/api/day-orders').expect(200)

    assert.deepStrictEqual(response.body, {})
  })

  test('an order is saved and can be replaced', async () => {
    await api.put('/api/day-orders/2026-09-21').send({ order: [data.mikko.id, data.anna.id] }).expect(200)
    await api.put('/api/day-orders/2026-09-21').send({ order: [data.anna.id, data.mikko.id] }).expect(200)

    const response = await api.get('/api/day-orders').expect(200)
    assert.deepStrictEqual(response.body, { '2026-09-21': [data.anna.id, data.mikko.id] })
  })

  test('another bar\'s employee cannot be in the order', async () => {
    await api.put('/api/day-orders/2026-09-21').send({ order: [data.olli.id] }).expect(400)
  })

  test('day must be a date', async () => {
    await api.put('/api/day-orders/not-a-day').send({ order: [] }).expect(400)
  })
})

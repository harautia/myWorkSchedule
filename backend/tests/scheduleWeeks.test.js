const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const db = require('../db/db')
const { resetDb, loginAs } = require('./helper')

// The fixture shift: Anna, Monday 2026-09-21 10:00-18:00 Helsinki time.
const WEEK = '2026-09-21'
const RANGE = { from: '2026-09-21T00:00:00Z', to: '2026-09-28T00:00:00Z' }

let data
let anna
let mikko

beforeEach(async () => {
  data = await resetDb()
  anna = await loginAs('anna')
  mikko = await loginAs('mikko')
})

after(() => db.destroy())

const statusOf = async (agent, week = WEEK) => {
  const response = await agent.get('/api/schedule-weeks').query({ from: week, to: '2026-09-28' }).expect(200)
  return response.body[week]
}
const shiftsSeenBy = async (agent) => (await agent.get('/api/shifts').query(RANGE).expect(200)).body
const lock = (week = WEEK) => anna.post(`/api/schedule-weeks/${week}/lock`)
const unlock = (week = WEEK) => anna.post(`/api/schedule-weeks/${week}/unlock`)

describe('a week that has never been locked', () => {
  test('is in planning: the manager sees it, employees don\'t', async () => {
    assert.deepStrictEqual(await statusOf(anna), { status: 'planning', lockedAt: null, lockedBy: null, published: false })
    assert.strictEqual((await shiftsSeenBy(anna)).length, 1)
    assert.deepStrictEqual(await shiftsSeenBy(mikko), [])
  })

  test('lists every week overlapping the range', async () => {
    const response = await anna.get('/api/schedule-weeks').query({ from: '2026-09-23', to: '2026-10-06' }).expect(200)
    assert.deepStrictEqual(Object.keys(response.body), ['2026-09-21', '2026-09-28', '2026-10-05'])
  })
})

describe('locking a week', () => {
  test('publishes its shifts and day orders to employees', async () => {
    await anna.put(`/api/day-orders/${WEEK}`).send({ order: [data.mikko.id, data.anna.id] }).expect(200)
    const response = await lock().expect(200)

    assert.strictEqual(response.body.status, 'locked')
    assert.strictEqual(response.body.lockedBy, 'anna')
    assert.strictEqual(response.body.published, true)
    assert.deepStrictEqual(await shiftsSeenBy(mikko), await shiftsSeenBy(anna))
    const orders = await mikko.get('/api/day-orders').expect(200)
    assert.deepStrictEqual(orders.body, { [WEEK]: [data.mikko.id, data.anna.id] })
  })

  test('stops all changes to the week', async () => {
    await lock().expect(200)

    const created = await anna
      .post('/api/shifts')
      .send({ employeeId: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
      .expect(409)
    assert.match(created.body.error, /week of 2026-09-21 is locked/)
    await anna.put(`/api/shifts/${data.ownShift.id}`).send({ start: '2026-09-21T08:00:00Z' }).expect(409)
    await anna.delete(`/api/shifts/${data.ownShift.id}`).expect(409)
    await anna.put('/api/day-orders/2026-09-27').send({ order: [data.anna.id] }).expect(409)
  })

  test('a shift can\'t be moved into a locked week', async () => {
    await lock('2026-09-28').expect(200)
    await anna.put(`/api/shifts/${data.ownShift.id}`)
      .send({ start: '2026-09-28T07:00:00Z', end: '2026-09-28T15:00:00Z' })
      .expect(409)
  })

  test('a shift after midnight belongs to the previous bar day and week', async () => {
    await lock().expect(200)
    // Monday 28.9. 01:00 Helsinki time is still Sunday's bar day.
    await anna.post('/api/shifts')
      .send({ employeeId: data.mikko.id, start: '2026-09-27T22:00:00Z', end: '2026-09-28T01:00:00Z' })
      .expect(409)
    // Monday 28.9. 10:00 is in the next week, which is still in planning.
    await anna.post('/api/shifts')
      .send({ employeeId: data.mikko.id, start: '2026-09-28T07:00:00Z', end: '2026-09-28T15:00:00Z' })
      .expect(201)
  })

  test('does not affect other bars', async () => {
    await lock().expect(200)
    const olli = await loginAs('olli')

    assert.strictEqual((await statusOf(olli)).status, 'planning')
    await olli.put(`/api/shifts/${data.otherShift.id}`).send({ start: '2026-09-21T09:00:00Z' }).expect(200)
  })
})

describe('unlocking a week', () => {
  test('allows changes while employees keep seeing the locked version until it is locked again', async () => {
    await lock().expect(200)
    const published = await shiftsSeenBy(mikko)

    const response = await unlock().expect(200)
    assert.strictEqual(response.body.status, 'planning')
    assert.strictEqual(response.body.published, true)

    await anna.put(`/api/shifts/${data.ownShift.id}`)
      .send({ start: '2026-09-21T09:00:00Z', end: '2026-09-21T17:00:00Z' })
      .expect(200)
    await anna.post('/api/shifts')
      .send({ employeeId: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z' })
      .expect(201)
    assert.deepStrictEqual(await shiftsSeenBy(mikko), published)

    await lock().expect(200)
    const republished = await shiftsSeenBy(mikko)
    assert.strictEqual(republished.length, 2)
    assert.strictEqual(republished[0].start, '2026-09-21T09:00:00.000Z')
  })

  test('a shift deleted while unlocked disappears for employees only after locking', async () => {
    await lock().expect(200)
    await unlock().expect(200)
    await anna.delete(`/api/shifts/${data.ownShift.id}`).expect(204)

    assert.strictEqual((await shiftsSeenBy(mikko)).length, 1)
    await lock().expect(200)
    assert.deepStrictEqual(await shiftsSeenBy(mikko), [])
  })
})

describe('access', () => {
  test('employees can see week statuses but not lock or unlock', async () => {
    await statusOf(mikko)
    await mikko.post(`/api/schedule-weeks/${WEEK}/lock`).expect(403)
    await mikko.post(`/api/schedule-weeks/${WEEK}/unlock`).expect(403)
  })

  test('a week is identified by its Monday', async () => {
    await lock('2026-09-22').expect(400)
    await lock('not-a-day').expect(400)
    await anna.get('/api/schedule-weeks').query({ from: 'x', to: '2026-09-28' }).expect(400)
  })
})

describe('adding shifts in one go', () => {
  const evening = (day) => ({ employeeId: data.mikko.id, start: `2026-09-${day}T15:00:00Z`, end: `2026-09-${day}T23:00:00Z` })

  test('adds a shift on each given day', async () => {
    const response = await anna.post('/api/shifts/batch')
      .send({ shifts: [evening(24), evening(22), evening(29)] })
      .expect(201)

    assert.deepStrictEqual(response.body.map((s) => s.start), [
      '2026-09-22T15:00:00.000Z', '2026-09-24T15:00:00.000Z', '2026-09-29T15:00:00.000Z'
    ])
    assert.strictEqual(response.body.every((s) => s.employeeId === data.mikko.id), true)
    assert.strictEqual((await db('shifts').where({ employee_id: data.mikko.id })).length, 3)
  })

  test('adds nothing if one day is in a locked week', async () => {
    await lock('2026-09-28').expect(200)
    const response = await anna.post('/api/shifts/batch').send({ shifts: [evening(22), evening(29)] }).expect(409)

    assert.match(response.body.error, /week of 2026-09-28 is locked/)
    assert.deepStrictEqual(await db('shifts').where({ employee_id: data.mikko.id }), [])
  })

  test('adds nothing if one shift is invalid', async () => {
    await anna.post('/api/shifts/batch')
      .send({ shifts: [evening(22), { ...evening(23), end: '2026-09-23T10:00:00Z' }] })
      .expect(400)
    await anna.post('/api/shifts/batch').send({ shifts: [evening(22), { ...evening(23), employeeId: data.olli.id }] }).expect(400)
    await anna.post('/api/shifts/batch').send({ shifts: [] }).expect(400)
    await anna.post('/api/shifts/batch').send({ shifts: 'x' }).expect(400)

    assert.deepStrictEqual(await db('shifts').where({ employee_id: data.mikko.id }), [])
  })

  test('is for managers only', async () => {
    await mikko.post('/api/shifts/batch').send({ shifts: [evening(22)] }).expect(403)
  })
})

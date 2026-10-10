const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { resetDb, loginAs, PASSWORD } = require('./helper')

const NEW_EMPLOYEE = { username: 'Kalle', name: ' Kalle ', password: 'kalle-password' }

// A manager (anna of Own Bar) managing the employees of their own bar.
let data
let api

beforeEach(async () => {
  data = await resetDb()
  api = await loginAs('anna')
})

after(() => db.destroy())

const login = async (username, password) => {
  const agent = supertest.agent(app)
  await agent.post('/api/login').send({ username, password }).expect(200)
  return agent
}

describe('employee details', () => {
  test('include the login account and the number of shifts', async () => {
    const response = await api.get('/api/employees/details').expect(200)

    assert.deepStrictEqual(
      response.body.map(({ name, account, shiftCount }) => ({ name, username: account?.username, shiftCount })),
      [
        { name: 'Anna', username: 'anna', shiftCount: 1 },
        { name: 'Mikko', username: 'mikko', shiftCount: 0 }
      ]
    )
  })
})

describe('adding an employee', () => {
  test('creates a waiter in the manager\'s bar with an employeeGroup login', async () => {
    const response = await api.post('/api/employees').send(NEW_EMPLOYEE).expect(201)

    assert.strictEqual(response.body.name, 'Kalle')
    assert.strictEqual(response.body.role, 'waiter')
    assert.match(response.body.color, /^#[0-9a-f]{6}$/)
    assert.deepStrictEqual(response.body.account, { username: 'kalle', email: null, groups: ['employeeGroup'] })
    assert.strictEqual(response.body.shiftCount, 0)

    const kalle = await login('kalle', NEW_EMPLOYEE.password)
    const me = await kalle.get('/api/me').expect(200)
    assert.strictEqual(me.body.barId, data.own.id)
    assert.strictEqual(me.body.employeeId, response.body.id)
    // Employees can see the schedule but not change it.
    await kalle.post('/api/employees').send({ ...NEW_EMPLOYEE, username: 'other' }).expect(403)
  })

  test('the bar in the request body is ignored', async () => {
    await api.post('/api/employees').send({ ...NEW_EMPLOYEE, barId: data.other.id }).expect(201)

    const user = await db('users').where({ username: 'kalle' }).first()
    assert.strictEqual(user.bar_id, data.own.id)
  })

  test('a username in use in another bar is refused without naming that bar', async () => {
    const response = await api.post('/api/employees').send({ ...NEW_EMPLOYEE, username: 'olli' }).expect(409)

    assert.match(response.body.error, /olli is already in use/)
    assert.doesNotMatch(response.body.error, /Other Bar/)
  })

  test('invalid accounts are refused', async () => {
    await api.post('/api/employees').send({ ...NEW_EMPLOYEE, username: 'a b' }).expect(400)
    await api.post('/api/employees').send({ ...NEW_EMPLOYEE, name: ' ' }).expect(400)
    await api.post('/api/employees').send({ ...NEW_EMPLOYEE, password: 'short' }).expect(400)

    const response = await api.get('/api/employees')
    assert.strictEqual(response.body.length, 2)
  })
})

describe('editing an employee', () => {
  test('renaming changes both the schedule and the account, sessions stay', async () => {
    const mikko = await loginAs('mikko')
    const response = await api.put(`/api/employees/${data.mikko.id}`).send({ name: ' Mikael ' }).expect(200)

    assert.strictEqual(response.body.name, 'Mikael')
    const me = await mikko.get('/api/me').expect(200)
    assert.strictEqual(me.body.name, 'Mikael')
  })

  test('a new password ends old sessions', async () => {
    const oldSession = await loginAs('mikko')
    await api.put(`/api/employees/${data.mikko.id}`).send({ password: 'new-password' }).expect(200)

    await oldSession.get('/api/me').expect(401)
    await supertest(app).post('/api/login').send({ username: 'mikko', password: PASSWORD }).expect(401)
    await login('mikko', 'new-password')
  })

  test('an employee without a login can be renamed but gets no password', async () => {
    const [liisa] = await db('employees')
      .insert({ bar_id: data.own.id, name: 'Liisa', role: 'waiter', color: '#0ca678' })
      .returning('*')

    await api.put(`/api/employees/${liisa.id}`).send({ name: 'Liisa K' }).expect(200)
    await api.put(`/api/employees/${liisa.id}`).send({ password: 'new-password' }).expect(400)
  })

  test('nothing to change is refused', async () => {
    await api.put(`/api/employees/${data.mikko.id}`).send({}).expect(400)
  })
})

describe('removing an employee', () => {
  test('deletes the login account, the employee and their shifts', async () => {
    await db('shifts').insert({
      bar_id: data.own.id, employee_id: data.mikko.id, start: '2026-09-22T15:00:00Z', end: '2026-09-22T23:00:00Z'
    })
    const mikko = await loginAs('mikko')

    await api.delete(`/api/employees/${data.mikko.id}`).expect(204)

    await mikko.get('/api/me').expect(401)
    assert.strictEqual(await db('users').where({ username: 'mikko' }).first(), undefined)
    assert.strictEqual(await db('employees').where({ id: data.mikko.id }).first(), undefined)
    assert.deepStrictEqual(await db('shifts').where({ employee_id: data.mikko.id }), [])
  })
})

describe('limits', () => {
  test('managers can\'t edit or remove managers, including themselves', async () => {
    await api.put(`/api/employees/${data.anna.id}`).send({ name: 'X' }).expect(403)
    await api.delete(`/api/employees/${data.anna.id}`).expect(403)
  })

  test('another bar\'s employees are not found', async () => {
    await api.put(`/api/employees/${data.olli.id}`).send({ name: 'X' }).expect(404)
    await api.delete(`/api/employees/${data.olli.id}`).expect(404)
    await api.delete('/api/employees/abc').expect(404)
  })

  test('employees can\'t manage employees', async () => {
    const mikko = await loginAs('mikko')
    await mikko.get('/api/employees/details').expect(403)
    await mikko.post('/api/employees').send(NEW_EMPLOYEE).expect(403)
    await mikko.put(`/api/employees/${data.anna.id}`).send({ name: 'X' }).expect(403)
    await mikko.delete(`/api/employees/${data.olli.id}`).expect(403)
  })
})

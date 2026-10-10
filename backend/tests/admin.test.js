const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')
const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { resetDb, loginAs, PASSWORD } = require('./helper')

const api = supertest(app)

const NEW_BAR = { name: 'Corner Pub', timezone: 'Europe/Stockholm', opensAt: '12:00', closesAt: '02:00' }
const NEW_MANAGER = { username: 'Kalle', name: 'Kalle Manager', password: 'long-enough-password' }

let data
let admin

beforeEach(async () => {
  data = await resetDb()
  admin = await loginAs('admin')
})

after(() => db.destroy())

const managerOf = async (barId) => {
  const response = await admin.get(`/api/admin/bars/${barId}`).expect(200)
  return response.body.users.find((user) => user.groups.includes('managerGroup'))
}

describe('only admins', () => {
  test('managers and employees cannot use admin operations', async () => {
    for (const username of ['anna', 'mikko']) {
      const agent = await loginAs(username)
      await agent.get(`/api/admin/bars/${data.own.id}`).expect(403)
      await agent.post('/api/admin/bars').send({ bar: NEW_BAR, manager: NEW_MANAGER }).expect(403)
      await agent.put(`/api/admin/bars/${data.own.id}`).send(NEW_BAR).expect(403)
    }
  })
})

describe('viewing a bar', () => {
  test('shows the bar and all its user accounts with groups and linked employee', async () => {
    const response = await admin.get(`/api/admin/bars/${data.own.id}`).expect(200)

    assert.strictEqual(response.body.bar.name, 'Own Bar')
    assert.deepStrictEqual(
      response.body.users.map(({ username, groups, employee }) => ({ username, groups, employee: employee?.name })),
      [
        { username: 'anna', groups: ['managerGroup'], employee: 'Anna' },
        { username: 'mikko', groups: ['employeeGroup'], employee: 'Mikko' }
      ]
    )
    assert.strictEqual(response.body.users[0].password_hash, undefined)
  })

  test('an unknown bar is 404', async () => {
    await admin.get('/api/admin/bars/9999').expect(404)
    await admin.get('/api/admin/bars/abc').expect(404)
  })
})

describe('creating a bar', () => {
  test('creates the bar and its manager, who can then log in to it', async () => {
    const response = await admin.post('/api/admin/bars').send({ bar: NEW_BAR, manager: NEW_MANAGER }).expect(201)

    assert.deepStrictEqual(
      { ...response.body.bar, id: undefined },
      // A new bar gets the default display settings.
      { id: undefined, name: 'Corner Pub', timezone: 'Europe/Stockholm', opensAt: '12:00', closesAt: '02:00', locale: 'en', clock24h: true, accentColor: '#863bff' }
    )
    assert.deepStrictEqual(
      response.body.users.map(({ username, groups, role }) => ({ username, groups, role })),
      [{ username: 'kalle', groups: ['managerGroup'], role: 'owner' }]
    )
    // The new bar is the only bar of a new organization.
    const bar = await db('bars').where({ id: response.body.bar.id }).first()
    const organization = await db('organizations').where({ id: bar.organization_id }).first()
    assert.strictEqual(organization.name, 'Corner Pub')
    assert.strictEqual((await db('bars').where({ organization_id: organization.id })).length, 1)

    const login = await api.post('/api/login').send({ username: 'kalle', password: NEW_MANAGER.password }).expect(200)
    assert.strictEqual(login.body.barName, 'Corner Pub')
  })

  test('the new manager is on the schedule as a manager, linked to the account', async () => {
    const response = await admin.post('/api/admin/bars').send({ bar: NEW_BAR, manager: NEW_MANAGER }).expect(201)
    const [kalle] = response.body.users
    assert.deepStrictEqual({ ...kalle.employee, id: undefined }, { id: undefined, name: 'Kalle Manager', role: 'manager' })

    const session = supertest.agent(app)
    const login = await session.post('/api/login').send({ username: 'kalle', password: NEW_MANAGER.password })
    assert.strictEqual(login.body.employeeId, kalle.employee.id)

    const employees = await session.get('/api/employees').expect(200)
    assert.deepStrictEqual(employees.body.map(({ name, role }) => ({ name, role })), [{ name: 'Kalle Manager', role: 'manager' }])
    assert.match(employees.body[0].color, /^#[0-9a-f]{6}$/)

    // and can be given shifts right away
    await session
      .post('/api/shifts')
      .send({ employeeId: kalle.employee.id, start: '2026-09-22T10:00:00Z', end: '2026-09-22T18:00:00Z' })
      .expect(201)
  })

  test('invalid bar or manager data is rejected and nothing is created', async () => {
    const cases = [
      { bar: { ...NEW_BAR, name: ' ' }, manager: NEW_MANAGER },
      { bar: { ...NEW_BAR, timezone: 'Mars/Olympus' }, manager: NEW_MANAGER },
      { bar: { ...NEW_BAR, opensAt: '25:00' }, manager: NEW_MANAGER },
      { bar: NEW_BAR, manager: { ...NEW_MANAGER, password: 'short' } },
      { bar: NEW_BAR, manager: { ...NEW_MANAGER, username: 'a b' } },
      { bar: NEW_BAR }
    ]
    for (const body of cases) {
      await admin.post('/api/admin/bars').send(body).expect(400)
    }
    assert.strictEqual(Number((await db('bars').count('* as count'))[0].count), 2)
  })

  test('a taken username is rejected and the bar is not created', async () => {
    const response = await admin
      .post('/api/admin/bars')
      .send({ bar: NEW_BAR, manager: { ...NEW_MANAGER, username: 'ANNA' } })
      .expect(409)
    assert.match(response.body.error, /username anna is already in use by a user in Own Bar/)
    assert.strictEqual(Number((await db('bars').count('* as count'))[0].count), 2)
  })

  test('a username is free again once its bar is deleted', async () => {
    await admin.delete(`/api/admin/bars/${data.own.id}`).expect(204)
    await admin.post('/api/admin/bars').send({ bar: NEW_BAR, manager: { ...NEW_MANAGER, username: 'anna' } }).expect(201)
  })
})

describe('editing a bar', () => {
  test('updates name, timezone and opening hours', async () => {
    const response = await admin.put(`/api/admin/bars/${data.own.id}`).send(NEW_BAR).expect(200)
    assert.strictEqual(response.body.name, 'Corner Pub')
    assert.strictEqual(response.body.opensAt, '12:00')

    const anna = await loginAs('anna')
    const bar = await anna.get('/api/bar').expect(200)
    assert.strictEqual(bar.body.timezone, 'Europe/Stockholm')
  })

  test('invalid data is rejected', async () => {
    await admin.put(`/api/admin/bars/${data.own.id}`).send({ ...NEW_BAR, closesAt: 'late' }).expect(400)
  })
})

describe('managers', () => {
  test('a manager can be added and removed', async () => {
    const added = await admin.post(`/api/admin/bars/${data.own.id}/managers`).send(NEW_MANAGER).expect(201)
    assert.deepStrictEqual(added.body.groups, ['managerGroup'])
    assert.strictEqual(added.body.employee.role, 'manager')

    const session = supertest.agent(app)
    await session.post('/api/login').send({ username: 'kalle', password: NEW_MANAGER.password }).expect(200)
    await session.get('/api/employees/details').expect(200)

    await admin.delete(`/api/admin/bars/${data.own.id}/managers/${added.body.id}`).expect(204)
    await session.get('/api/me').expect(401)

    // the schedule entry stays, with a colour of its own
    const employees = await (await loginAs('anna')).get('/api/employees')
    const colors = employees.body.map((e) => e.color)
    assert.ok(employees.body.some((e) => e.name === 'Kalle Manager'))
    assert.strictEqual(new Set(colors).size, colors.length)
  })

  test('when the owner is removed, the oldest remaining manager becomes the owner', async () => {
    const first = await admin.post(`/api/admin/bars/${data.own.id}/managers`).send(NEW_MANAGER).expect(201)
    assert.strictEqual(first.body.role, 'manager')
    await admin.post(`/api/admin/bars/${data.own.id}/managers`)
      .send({ ...NEW_MANAGER, username: 'later', name: 'Later Manager' })
      .expect(201)

    const users = (await admin.get(`/api/admin/bars/${data.own.id}`)).body.users
    const anna = users.find((user) => user.username === 'anna')
    assert.strictEqual(anna.role, 'owner')
    await admin.delete(`/api/admin/bars/${data.own.id}/managers/${anna.id}`).expect(204)

    const after = (await admin.get(`/api/admin/bars/${data.own.id}`)).body.users
    assert.deepStrictEqual(
      after.filter((user) => user.role !== 'employee').map(({ username, role }) => `${username}:${role}`).sort(),
      ['kalle:owner', 'later:manager']
    )
  })

  test('the last manager of a bar cannot be removed', async () => {
    const anna = await managerOf(data.own.id)
    await admin.delete(`/api/admin/bars/${data.own.id}/managers/${anna.id}`).expect(409)
  })

  test('only managers of that bar can be edited or removed', async () => {
    const mikko = (await admin.get(`/api/admin/bars/${data.own.id}`)).body.users.find((u) => u.username === 'mikko')
    await admin.put(`/api/admin/bars/${data.own.id}/managers/${mikko.id}`).send({ name: 'x' }).expect(404)
    await admin.delete(`/api/admin/bars/${data.own.id}/managers/${mikko.id}`).expect(404)

    const olli = await managerOf(data.other.id)
    await admin.put(`/api/admin/bars/${data.own.id}/managers/${olli.id}`).send({ name: 'x' }).expect(404)
  })

  test('resetting the password lets the manager log in with the new one and ends old sessions', async () => {
    const oldSession = await loginAs('anna')
    const anna = await managerOf(data.own.id)

    await admin
      .put(`/api/admin/bars/${data.own.id}/managers/${anna.id}`)
      .send({ password: 'brand-new-password' })
      .expect(200)

    await oldSession.get('/api/me').expect(401)
    await api.post('/api/login').send({ username: 'anna', password: PASSWORD }).expect(401)
    await api.post('/api/login').send({ username: 'anna', password: 'brand-new-password' }).expect(200)
  })

  test('changing only the name keeps sessions', async () => {
    const session = await loginAs('anna')
    const anna = await managerOf(data.own.id)

    const response = await admin
      .put(`/api/admin/bars/${data.own.id}/managers/${anna.id}`)
      .send({ name: 'Anna Virtanen' })
      .expect(200)
    assert.strictEqual(response.body.name, 'Anna Virtanen')

    const me = await session.get('/api/me').expect(200)
    assert.strictEqual(me.body.name, 'Anna Virtanen')

    // the linked schedule entry is renamed too
    const employees = await session.get('/api/employees')
    assert.strictEqual(employees.body.find((e) => e.id === data.anna.id).name, 'Anna Virtanen')
  })

  test('a too short password or empty change is rejected', async () => {
    const anna = await managerOf(data.own.id)
    await admin.put(`/api/admin/bars/${data.own.id}/managers/${anna.id}`).send({ password: 'short' }).expect(400)
    await admin.put(`/api/admin/bars/${data.own.id}/managers/${anna.id}`).send({}).expect(400)
  })
})

describe('deleting a bar', () => {
  test('removes the bar with all its managers\' and employees\' data', async () => {
    const session = await loginAs('anna')
    const ownUserIds = await db('memberships').where({ bar_id: data.own.id }).pluck('user_id')
    const { organization_id: organizationId } = await db('bars').where({ id: data.own.id }).first()
    await admin.delete(`/api/admin/bars/${data.own.id}`).expect(204)

    const [{ count: userCount }] = await db('users').whereIn('id', ownUserIds).count('* as count')
    assert.strictEqual(Number(userCount), 0, 'users')
    assert.strictEqual(await db('organizations').where({ id: organizationId }).first(), undefined, 'organization')
    const [{ count: employeeCount }] = await db('employees').whereIn('id', [data.anna.id, data.mikko.id]).count('* as count')
    assert.strictEqual(Number(employeeCount), 0, 'employees by id')

    await admin.get(`/api/admin/bars/${data.own.id}`).expect(404)
    const bars = await admin.get('/api/admin/bars')
    assert.deepStrictEqual(bars.body.map((b) => b.name), ['Other Bar'])

    for (const table of ['employees', 'shifts', 'day_orders', 'memberships']) {
      const [{ count }] = await db(table).where({ bar_id: data.own.id }).count('* as count')
      assert.strictEqual(Number(count), 0, table)
    }
    await session.get('/api/me').expect(401)
    await api.post('/api/login').send({ username: 'mikko', password: PASSWORD }).expect(401)
  })

  test('an account that also belongs to another bar is kept', async () => {
    const [olli] = await db('users').where({ username: 'olli' }).pluck('id')
    await db('memberships').insert({ user_id: olli, bar_id: data.own.id, role: 'employee' })

    await admin.delete(`/api/admin/bars/${data.other.id}`).expect(204)

    const session = await loginAs('olli')
    const me = await session.get('/api/me').expect(200)
    assert.strictEqual(me.body.barId, data.own.id)
    assert.deepStrictEqual(me.body.groups, ['employeeGroup'])
  })

  test('other bars are untouched', async () => {
    await admin.delete(`/api/admin/bars/${data.own.id}`).expect(204)

    const olli = await loginAs('olli')
    const shifts = await olli.get('/api/shifts').query({ from: '2026-09-21T00:00:00Z', to: '2026-09-28T00:00:00Z' })
    assert.deepStrictEqual(shifts.body.map((s) => s.id), [data.otherShift.id])
  })

  test('only admins can delete, and an unknown bar is 404', async () => {
    const anna = await loginAs('anna')
    await anna.delete(`/api/admin/bars/${data.own.id}`).expect(403)
    await admin.delete('/api/admin/bars/9999').expect(404)
  })
})

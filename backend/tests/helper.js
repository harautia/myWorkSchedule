const supertest = require('supertest')
const app = require('../app')
const db = require('../db/db')
const { hashPassword } = require('../utils/passwords')

const PASSWORD = 'test-password'
let passwordHash

const insertUser = async (username, { barId = null, employeeId = null, groups }) => {
  passwordHash ??= await hashPassword(PASSWORD)
  const [user] = await db('users')
    .insert({ username, name: username, bar_id: barId, employee_id: employeeId, password_hash: passwordHash })
    .returning('*')
  await db('user_groups').insert(groups.map((group) => ({ user_id: user.id, group_name: group })))
  return user
}

// Two bars. Users of "own" must never see or change anything in "other".
const resetDb = async () => {
  await db.raw('TRUNCATE user_groups, users, day_orders, shifts, employees, bars RESTART IDENTITY CASCADE')

  const [own, other] = await db('bars')
    .insert([{ name: 'Own Bar' }, { name: 'Other Bar' }])
    .returning('*')

  const [anna, mikko] = await db('employees')
    .insert([
      { bar_id: own.id, name: 'Anna', role: 'manager', color: '#863bff' },
      { bar_id: own.id, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }
    ])
    .returning('*')
  const [olli] = await db('employees')
    .insert([{ bar_id: other.id, name: 'Olli', role: 'waiter', color: '#000000' }])
    .returning('*')

  const [ownShift] = await db('shifts')
    .insert([{ bar_id: own.id, employee_id: anna.id, start: '2026-09-21T07:00:00Z', end: '2026-09-21T15:00:00Z' }])
    .returning('*')
  const [otherShift] = await db('shifts')
    .insert([{ bar_id: other.id, employee_id: olli.id, start: '2026-09-21T08:00:00Z', end: '2026-09-21T16:00:00Z' }])
    .returning('*')

  await db('day_orders').insert({ bar_id: other.id, day: '2026-09-21', employee_ids: JSON.stringify([olli.id]) })

  await insertUser('admin', { groups: ['adminGroup'] })
  await insertUser('anna', { barId: own.id, employeeId: anna.id, groups: ['managerGroup'] })
  await insertUser('mikko', { barId: own.id, employeeId: mikko.id, groups: ['employeeGroup'] })
  await insertUser('olli', { barId: other.id, employeeId: olli.id, groups: ['managerGroup'] })

  return { own, other, anna, mikko, olli, ownShift, otherShift }
}

// A supertest agent that keeps the session cookie between requests.
const loginAs = async (username) => {
  const agent = supertest.agent(app)
  await agent.post('/api/login').send({ username, password: PASSWORD }).expect(200)
  return agent
}

module.exports = { resetDb, loginAs, PASSWORD }

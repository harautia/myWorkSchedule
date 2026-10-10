const http = require('http')
const supertest = require('supertest')

// supertest starts a new server for every request. With keep-alive (Node's
// default since v19) a pooled connection could reach an old server whose port
// was reused, mixing up responses between tests now and then.
http.globalAgent = new http.Agent({ keepAlive: false })
const app = require('../app')
const db = require('../db/db')
const { hashPassword } = require('../utils/passwords')

const PASSWORD = 'test-password'
let passwordHash

// A platform admin (isAdmin) or a member of a bar with `role`.
const insertUser = async (username, { barId = null, employeeId = null, role = null, isAdmin = false }) => {
  passwordHash ??= await hashPassword(PASSWORD)
  const [user] = await db('users')
    .insert({ username, name: username, is_admin: isAdmin, password_hash: passwordHash })
    .returning('*')
  if (barId) await db('memberships').insert({ user_id: user.id, bar_id: barId, employee_id: employeeId, role })
  return user
}

// Two bars. Users of "own" must never see or change anything in "other".
const resetDb = async () => {
  await db.raw('TRUNCATE password_resets, invites, published_shifts, schedule_weeks, memberships, users, day_orders, shifts, employees, bars, organizations RESTART IDENTITY CASCADE')

  const [ownOrganization, otherOrganization] = await db('organizations')
    .insert([{ name: 'Own Bar' }, { name: 'Other Bar' }])
    .returning('*')
  const [own, other] = await db('bars')
    .insert([
      { name: 'Own Bar', organization_id: ownOrganization.id },
      { name: 'Other Bar', organization_id: otherOrganization.id }
    ])
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

  await insertUser('admin', { isAdmin: true })
  await insertUser('anna', { barId: own.id, employeeId: anna.id, role: 'owner' })
  await insertUser('mikko', { barId: own.id, employeeId: mikko.id, role: 'employee' })
  await insertUser('olli', { barId: other.id, employeeId: olli.id, role: 'owner' })

  return { own, other, anna, mikko, olli, ownShift, otherShift }
}

// A supertest agent that keeps the session cookie between requests.
const loginAs = async (username) => {
  const agent = supertest.agent(app)
  await agent.post('/api/login').send({ username, password: PASSWORD }).expect(200)
  return agent
}

module.exports = { resetDb, loginAs, insertUser, PASSWORD }

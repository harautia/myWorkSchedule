// Development data: two bars with employees, shifts and login accounts.
// Shifts are generated for the previous, current and next four weeks
// (relative to when the seed is run) so the calendar has something to show.
// The previous, current and next week are locked (published to employees);
// the later weeks are still in planning.
//
// All accounts use the password DEV_PASSWORD. Never run this in production.
const { hashPassword } = require('../../utils/passwords')
const ScheduleWeeks = require('../../models/scheduleWeeks')

const DEV_PASSWORD = 'secret'

const IMAGINARY_EMPLOYEES = [
  { name: 'Anna', role: 'manager', color: '#863bff' },
  { name: 'Mikko', role: 'waiter', color: '#1c7ed6' },
  { name: 'Liisa', role: 'waiter', color: '#0ca678' },
  { name: 'Jukka', role: 'waiter', color: '#e8590c' },
  { name: 'Sanna', role: 'waiter', color: '#d6336c' },
  { name: 'Pekka', role: 'waiter', color: '#5c940d' },
  { name: 'Emma', role: 'waiter', color: '#c2255c' }
]

// Weekly rota template: [dayIndex (0 = Mon), employee index + 1, startHour, lengthHours]
const IMAGINARY_TEMPLATE = [
  [0, 1, 10, 8], [0, 4, 11, 8], [0, 2, 16, 8], [0, 5, 17, 7],
  [1, 1, 10, 8], [1, 7, 11, 8], [1, 3, 16, 8], [1, 6, 17, 7],
  [2, 1, 10, 8], [2, 4, 11, 8], [2, 2, 16, 8], [2, 5, 17, 7],
  [3, 1, 12, 8], [3, 7, 11, 8], [3, 3, 16, 8], [3, 6, 18, 6], [3, 2, 20, 8],
  [4, 1, 14, 8], [4, 4, 11, 8], [4, 7, 16, 8], [4, 2, 18, 10], [4, 3, 18, 10], [4, 5, 17, 9], [4, 6, 19, 8],
  [5, 4, 11, 8], [5, 7, 16, 8], [5, 2, 18, 10], [5, 3, 18, 10], [5, 5, 17, 9], [5, 6, 19, 8], [5, 1, 20, 6],
  [6, 1, 12, 6], [6, 4, 12, 6], [6, 3, 14, 8], [6, 6, 14, 8]
]

// Monday 00:00 (local time) of the week containing date.
const weekStart = (date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

const LOCKED_WEEKS = 3

// 'yyyy-MM-dd' of a local date.
const toDayKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const atHour = (day, dayOffset, hour) =>
  new Date(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset, hour)

const HARBOUR_EMPLOYEES = [
  { name: 'Laura', role: 'manager', color: '#1971c2' },
  { name: 'Ville', role: 'waiter', color: '#e67700' },
  { name: 'Aino', role: 'waiter', color: '#2b8a3e' }
]

const HARBOUR_TEMPLATE = [
  [1, 1, 12, 8], [1, 2, 16, 8],
  [2, 1, 12, 8], [2, 3, 16, 8],
  [3, 1, 12, 8], [3, 2, 16, 10],
  [4, 1, 14, 8], [4, 2, 18, 10], [4, 3, 18, 10],
  [5, 2, 18, 10], [5, 3, 18, 10], [5, 1, 20, 6]
]

// Login accounts per bar: [username, employee index + 1, groups]
const IMAGINARY_USERS = [
  ['anna', 1, ['managerGroup']],
  ['mikko', 2, ['employeeGroup']],
  ['liisa', 3, ['employeeGroup']]
]
const HARBOUR_USERS = [
  ['laura', 1, ['managerGroup']],
  ['ville', 2, ['employeeGroup']]
]

const buildShifts = (barId, employeeIds, template) => {
  const base = weekStart(new Date())
  base.setDate(base.getDate() - 7)

  const shifts = []
  for (let week = 0; week < 6; week++) {
    template.forEach(([day, employeeNumber, startHour, length]) => {
      const start = atHour(base, week * 7 + day, startHour)
      shifts.push({
        bar_id: barId,
        employee_id: employeeIds[employeeNumber - 1],
        start,
        end: new Date(start.getTime() + length * 60 * 60 * 1000)
      })
    })
  }
  return shifts
}

const insertUser = async (knex, { username, name, barId, employeeId, groups, passwordHash }) => {
  const [user] = await knex('users')
    .insert({ username, name, bar_id: barId, employee_id: employeeId, password_hash: passwordHash })
    .returning('id')
  await knex('user_groups').insert(groups.map((group) => ({ user_id: user.id, group_name: group })))
  return user.id
}

const insertBar = async (knex, { bar, employees, template, users, passwordHash }) => {
  const [{ id: barId }] = await knex('bars').insert(bar).returning('id')
  const employeeIds = (
    await knex('employees')
      .insert(employees.map((employee) => ({ ...employee, bar_id: barId })))
      .returning('id')
  ).map((row) => row.id)

  await knex('shifts').insert(buildShifts(barId, employeeIds, template))

  let managerId = null
  for (const [username, employeeNumber, groups] of users) {
    const userId = await insertUser(knex, {
      username,
      name: employees[employeeNumber - 1].name,
      barId,
      employeeId: employeeIds[employeeNumber - 1],
      groups,
      passwordHash
    })
    if (groups.includes('managerGroup')) managerId ??= userId
  }

  const firstWeek = weekStart(new Date())
  firstWeek.setDate(firstWeek.getDate() - 7)
  for (let week = 0; week < LOCKED_WEEKS; week++) {
    const monday = new Date(firstWeek.getFullYear(), firstWeek.getMonth(), firstWeek.getDate() + week * 7)
    await ScheduleWeeks.lock(barId, toDayKey(monday), managerId, knex)
  }
}

exports.seed = async (knex) => {
  await knex.raw('TRUNCATE published_shifts, schedule_weeks, user_groups, users, day_orders, shifts, employees, bars RESTART IDENTITY CASCADE')

  const passwordHash = await hashPassword(DEV_PASSWORD)

  // The service admin works across all bars, so has no bar of their own.
  await insertUser(knex, {
    username: 'admin',
    name: 'Service Admin',
    barId: null,
    employeeId: null,
    groups: ['adminGroup'],
    passwordHash
  })

  await insertBar(knex, {
    bar: { name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opens_at: '10:00', closes_at: '04:00' },
    employees: IMAGINARY_EMPLOYEES,
    template: IMAGINARY_TEMPLATE,
    users: IMAGINARY_USERS,
    passwordHash
  })
  await insertBar(knex, {
    bar: { name: 'Harbour Pub', timezone: 'Europe/Helsinki', opens_at: '10:00', closes_at: '04:00' },
    employees: HARBOUR_EMPLOYEES,
    template: HARBOUR_TEMPLATE,
    users: HARBOUR_USERS,
    passwordHash
  })
}

const db = require('../db/db')

// Two bars: "own" gets id 1, which is the bar every request acts on until
// login exists (config.DEFAULT_BAR_ID). "other" must stay invisible.
const resetDb = async () => {
  await db.raw('TRUNCATE day_orders, shifts, employees, bars RESTART IDENTITY CASCADE')

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

  return { own, other, anna, mikko, olli, ownShift, otherShift }
}

module.exports = { resetDb }

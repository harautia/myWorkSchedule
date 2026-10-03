const db = require('../db/db')
const { weekOfSql, weekOfDay, addDays } = require('../utils/weeks')

const LOCKED = 'locked'
const PLANNING = 'planning'

// published: a locked snapshot exists that employees see. Stays true after
// unlocking; employees keep seeing the last locked version.
const toDto = (row) => ({
  status: row.status,
  lockedAt: row.locked_at ? row.locked_at.toISOString() : null,
  lockedBy: row.locked_by_name ?? null,
  published: Boolean(row.locked_at)
})

const NEVER_LOCKED = { status: PLANNING, lockedAt: null, lockedBy: null, published: false }

// { 'yyyy-MM-dd' (Monday) -> status } for every week starting in
// [fromWeek, toWeek). fromWeek must be a Monday.
const getInRange = async (barId, fromWeek, toWeek) => {
  const rows = await db('schedule_weeks')
    .leftJoin('users', 'users.id', 'schedule_weeks.locked_by')
    .where('schedule_weeks.bar_id', barId)
    .where('week_start', '>=', fromWeek)
    .where('week_start', '<', toWeek)
    .select('schedule_weeks.*', 'users.name as locked_by_name')
  const saved = new Map(rows.map((row) => [row.week_start, toDto(row)]))

  const weeks = {}
  for (let week = fromWeek; week < toWeek; week = addDays(week, 7)) {
    weeks[week] = saved.get(week) ?? NEVER_LOCKED
  }
  return weeks
}

const getWeek = async (barId, week) => (await getInRange(barId, week, addDays(week, 7)))[week]

const isLocked = async (barId, week, conn = db) => {
  const row = await conn('schedule_weeks').where({ bar_id: barId, week_start: week }).first('status')
  return row?.status === LOCKED
}

// Locks the week and makes its current shifts and day orders the version
// employees see.
const lock = (barId, week, userId, conn = db) =>
  conn.transaction(async (trx) => {
    await trx('published_shifts').where({ bar_id: barId, week_start: week }).del()
    // The start range only lets the index narrow the rows; the week rule decides.
    await trx.raw(
      `INSERT INTO published_shifts (bar_id, week_start, shift_id, employee_id, start, "end")
       SELECT shifts.bar_id, ?::date, shifts.id, shifts.employee_id, shifts.start, shifts."end"
       FROM shifts JOIN bars ON bars.id = shifts.bar_id
       WHERE shifts.bar_id = ?
         AND shifts.start >= ?::date - 2 AND shifts.start < ?::date + 9
         AND ${weekOfSql('shifts.start')} = ?::date`,
      [week, barId, week, week, week]
    )

    const orders = await trx('day_orders')
      .where({ bar_id: barId })
      .where('day', '>=', week)
      .where('day', '<', addDays(week, 7))
    const publishedDayOrders = Object.fromEntries(orders.map((row) => [row.day, row.employee_ids]))

    const values = {
      status: LOCKED,
      locked_at: trx.fn.now(),
      locked_by: userId,
      published_day_orders: JSON.stringify(publishedDayOrders),
      updated_at: trx.fn.now()
    }
    await trx('schedule_weeks')
      .insert({ bar_id: barId, week_start: week, ...values })
      .onConflict(['bar_id', 'week_start'])
      .merge(values)
  })

// Back to planning. The snapshot is kept, so employees still see it.
const unlock = (barId, week) =>
  db('schedule_weeks')
    .where({ bar_id: barId, week_start: week })
    .update({ status: PLANNING, updated_at: db.fn.now() })

// The locked version of shifts starting in [from, to), shaped like live shifts.
const publishedShifts = async (barId, from, to) => {
  const rows = await db('published_shifts')
    .where({ bar_id: barId })
    .where('start', '>=', from)
    .where('start', '<', to)
    .orderBy('start')
  return rows.map((row) => ({
    id: row.shift_id,
    employeeId: row.employee_id,
    start: row.start.toISOString(),
    end: row.end.toISOString()
  }))
}

// The locked version of day orders: { 'yyyy-MM-dd': [employeeId, ...] },
// optionally only days in [from, to).
const publishedDayOrders = async (barId, from, to) => {
  let query = db('schedule_weeks').where({ bar_id: barId })
  if (from) query = query.where('week_start', '>=', weekOfDay(from))
  if (to) query = query.where('week_start', '<', to)
  const rows = await query.select('published_day_orders')

  const orders = Object.assign({}, ...rows.map((row) => row.published_day_orders))
  return Object.fromEntries(
    Object.entries(orders).filter(([day]) => (!from || day >= from) && (!to || day < to))
  )
}

module.exports = { LOCKED, PLANNING, getInRange, getWeek, isLocked, lock, unlock, publishedShifts, publishedDayOrders }

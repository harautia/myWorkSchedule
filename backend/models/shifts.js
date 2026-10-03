const db = require('../db/db')

const toDto = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  start: row.start.toISOString(),
  end: row.end.toISOString()
})

// Shifts starting in [from, to), optionally only one employee's.
const getInRange = async (barId, from, to, { employeeId } = {}) => {
  let query = db('shifts').where({ bar_id: barId })
  if (employeeId !== undefined) query = query.where({ employee_id: employeeId })
  const rows = await query
    .where('start', '>=', from)
    .where('start', '<', to)
    .orderBy('start')
  return rows.map(toDto)
}

const create = async (barId, { employeeId, start, end }) => {
  const [row] = await db('shifts')
    .insert({ bar_id: barId, employee_id: employeeId, start, end })
    .returning('*')
  return toDto(row)
}

// Several shifts at once, e.g. the same shift on several days. Pass a
// transaction to make it all-or-nothing.
const createMany = async (barId, shifts, conn = db) => {
  const rows = await conn('shifts')
    .insert(shifts.map(({ employeeId, start, end }) => ({ bar_id: barId, employee_id: employeeId, start, end })))
    .returning('*')
  return rows.map(toDto).sort((a, b) => a.start.localeCompare(b.start))
}

const update = async (barId, id, { employeeId, start, end }) => {
  const changes = { updated_at: db.fn.now() }
  if (employeeId !== undefined) changes.employee_id = employeeId
  if (start !== undefined) changes.start = start
  if (end !== undefined) changes.end = end

  const [row] = await db('shifts').where({ bar_id: barId, id }).update(changes).returning('*')
  return row ? toDto(row) : null
}

const remove = async (barId, id) => {
  const count = await db('shifts').where({ bar_id: barId, id }).del()
  return count > 0
}

const getById = async (barId, id) => {
  const row = await db('shifts').where({ bar_id: barId, id }).first()
  return row ? toDto(row) : null
}

// { employeeId -> number of shifts } for the bar's employees that have shifts.
const countsByEmployee = async (barId) => {
  const rows = await db('shifts').where({ bar_id: barId }).groupBy('employee_id').select('employee_id').count('* as count')
  return new Map(rows.map((row) => [row.employee_id, Number(row.count)]))
}

module.exports = { getInRange, getById, create, createMany, update, remove, countsByEmployee }

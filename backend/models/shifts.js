const db = require('../db/db')

const toDto = (row) => ({
  id: row.id,
  employeeId: row.employee_id,
  start: row.start.toISOString(),
  end: row.end.toISOString()
})

// Shifts starting in [from, to).
const getInRange = async (barId, from, to) => {
  const rows = await db('shifts')
    .where({ bar_id: barId })
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

module.exports = { getInRange, getById, create, update, remove }

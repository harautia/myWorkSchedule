const db = require('../db/db')

// Returns { 'yyyy-MM-dd': [employeeId, ...] }, the shape the frontend uses.
const getAll = async (barId, from, to) => {
  let query = db('day_orders').where({ bar_id: barId })
  if (from) query = query.where('day', '>=', from)
  if (to) query = query.where('day', '<', to)
  const rows = await query
  return Object.fromEntries(rows.map((row) => [row.day, row.employee_ids]))
}

const save = async (barId, day, employeeIds) => {
  const [row] = await db('day_orders')
    .insert({ bar_id: barId, day, employee_ids: JSON.stringify(employeeIds) })
    .onConflict(['bar_id', 'day'])
    .merge({ employee_ids: JSON.stringify(employeeIds), updated_at: db.fn.now() })
    .returning('*')
  return row.employee_ids
}

module.exports = { getAll, save }

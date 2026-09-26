const db = require('../db/db')

const toDto = (row) => ({
  id: row.id,
  name: row.name,
  role: row.role,
  color: row.color
})

// Legend order = insertion order.
const getAll = async (barId) => {
  const rows = await db('employees').where({ bar_id: barId }).orderBy('id')
  return rows.map(toDto)
}

const exists = async (barId, id) => {
  const row = await db('employees').where({ bar_id: barId, id }).first('id')
  return Boolean(row)
}

module.exports = { getAll, exists }

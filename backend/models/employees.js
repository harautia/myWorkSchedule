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

const getById = async (barId, id) => {
  const row = await db('employees').where({ bar_id: barId, id }).first()
  return row ? toDto(row) : null
}

const exists = async (barId, id) => {
  const row = await db('employees').where({ bar_id: barId, id }).first('id')
  return Boolean(row)
}

const create = async (barId, { name, role, color }, conn = db) => {
  const [row] = await conn('employees').insert({ bar_id: barId, name, role, color }).returning('*')
  return toDto(row)
}

const usedColors = async (barId, conn = db) =>
  (await conn('employees').where({ bar_id: barId }).select('color')).map((row) => row.color)

const rename = (barId, id, name, conn = db) => conn('employees').where({ bar_id: barId, id }).update({ name })

// Also deletes the employee's shifts (foreign key cascade). A linked login
// account is only unlinked, so delete it first if it should go too.
const remove = (barId, id, conn = db) => conn('employees').where({ bar_id: barId, id }).del()

module.exports = { getAll, getById, exists, create, usedColors, rename, remove }

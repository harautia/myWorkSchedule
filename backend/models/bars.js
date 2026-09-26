const db = require('../db/db')

// 'HH:mm:ss' -> 'HH:mm'
const toHourMinute = (time) => time.slice(0, 5)

const toDto = (row) => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  opensAt: toHourMinute(row.opens_at),
  closesAt: toHourMinute(row.closes_at)
})

const getById = async (barId) => {
  const row = await db('bars').where({ id: barId }).first()
  return row ? toDto(row) : null
}

module.exports = { getById }

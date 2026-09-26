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

// Admin only: every bar, with how many employees and user accounts it has.
const getAllWithCounts = async () => {
  const rows = await db('bars')
    .select(
      'bars.*',
      db('employees').count('*').whereRaw('employees.bar_id = bars.id').as('employee_count'),
      db('users').count('*').whereRaw('users.bar_id = bars.id').as('user_count')
    )
    .orderBy('bars.name')
  return rows.map((row) => ({
    ...toDto(row),
    createdAt: row.created_at.toISOString(),
    employeeCount: Number(row.employee_count),
    userCount: Number(row.user_count)
  }))
}

module.exports = { getById, getAllWithCounts }

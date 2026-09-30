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

const toRow = ({ name, timezone, opensAt, closesAt }) => ({
  name: name.trim(),
  timezone,
  opens_at: opensAt,
  closes_at: closesAt
})

const create = async (bar, conn = db) => {
  const [row] = await conn('bars').insert(toRow(bar)).returning('id')
  return row.id
}

const update = async (barId, bar) => {
  const count = await db('bars').where({ id: barId }).update(toRow(bar))
  return count > 0
}

// Deletes the bar and, through ON DELETE CASCADE, its employees, shifts,
// day orders and user accounts.
const remove = async (barId) => (await db('bars').where({ id: barId }).del()) > 0

module.exports = { getById, getAllWithCounts, create, update, remove }

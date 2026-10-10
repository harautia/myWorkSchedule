const db = require('../db/db')
const Users = require('./users')

// 'HH:mm:ss' -> 'HH:mm'
const toHourMinute = (time) => time.slice(0, 5)

const toDto = (row) => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  opensAt: toHourMinute(row.opens_at),
  closesAt: toHourMinute(row.closes_at),
  locale: row.locale,
  clock24h: row.clock_24h,
  accentColor: row.accent_color
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
      db('memberships').count('*').whereRaw('memberships.bar_id = bars.id').as('user_count')
    )
    .orderBy('bars.name')
  return rows.map((row) => ({
    ...toDto(row),
    createdAt: row.created_at.toISOString(),
    employeeCount: Number(row.employee_count),
    userCount: Number(row.user_count)
  }))
}

// Display settings left out keep their current value (or the default for a new bar).
const toRow = ({ name, timezone, opensAt, closesAt, locale, clock24h, accentColor }) => {
  const row = { name: name.trim(), timezone, opens_at: opensAt, closes_at: closesAt }
  if (locale !== undefined) row.locale = locale
  if (clock24h !== undefined) row.clock_24h = clock24h
  if (accentColor !== undefined) row.accent_color = accentColor.toLowerCase()
  return row
}

// Without an organizationId the bar gets a new organization of its own, with
// the same name. Run inside a transaction.
const create = async (bar, conn = db, { organizationId } = {}) => {
  let id = organizationId
  if (!id) {
    const [organization] = await conn('organizations').insert({ name: bar.name.trim() }).returning('id')
    id = organization.id
  }
  const [row] = await conn('bars').insert({ ...toRow(bar), organization_id: id }).returning('id')
  return row.id
}

const update = async (barId, bar) => {
  const count = await db('bars').where({ id: barId }).update(toRow(bar))
  return count > 0
}

// Deletes the bar and, through ON DELETE CASCADE, its employees, shifts and
// day orders. Accounts left without any bar are deleted too, and so is the
// organization when this was its last bar.
const remove = (barId) =>
  db.transaction(async (trx) => {
    const memberIds = await trx('memberships').where({ bar_id: barId }).pluck('user_id')
    const [bar] = await trx('bars').where({ id: barId }).del().returning('organization_id')
    if (!bar) return false

    await Users.removeWithoutBar(memberIds, trx)
    await trx('organizations')
      .where({ id: bar.organization_id })
      .whereNotExists(trx('bars').whereRaw('bars.organization_id = organizations.id'))
      .del()
    return true
  })

module.exports = { getById, getAllWithCounts, create, update, remove }

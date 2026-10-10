const db = require('../db/db')
const { createToken, hashToken } = require('../utils/tokens')

// How long an invitation link works.
const INVITE_DAYS = 7

// Invites a person, already on the schedule as `employeeId`, to create their
// login account. Only the newest invitation of an employee works. Returns the
// token for the link.
const create = async ({ barId, employeeId, email, group, invitedBy = null }, conn = db) => {
  await conn('invites').where({ bar_id: barId, employee_id: employeeId }).whereNull('accepted_at').del()
  const { token, hash } = createToken()
  await conn('invites').insert({
    token_hash: hash,
    bar_id: barId,
    employee_id: employeeId,
    email: email.trim().toLowerCase(),
    group_name: group,
    invited_by: invitedBy,
    expires_at: conn.raw(`now() + interval '${INVITE_DAYS} days'`)
  })
  return token
}

// A usable invitation (not accepted, not expired), with the names to greet
// the person: { id, barId, employeeId, email, group, name, barName, locale }.
const findValid = async (token, conn = db) => {
  const row = await conn('invites')
    .join('employees', 'employees.id', 'invites.employee_id')
    .join('bars', 'bars.id', 'invites.bar_id')
    .where('invites.token_hash', hashToken(token))
    .whereNull('invites.accepted_at')
    .where('invites.expires_at', '>', conn.fn.now())
    .first('invites.*', 'employees.name as employee_name', 'bars.name as bar_name', 'bars.locale as bar_locale')
  if (!row) return null
  return {
    id: row.id,
    barId: row.bar_id,
    employeeId: row.employee_id,
    email: row.email,
    group: row.group_name,
    name: row.employee_name,
    barName: row.bar_name,
    locale: row.bar_locale
  }
}

const markAccepted = (id, conn = db) => conn('invites').where({ id }).update({ accepted_at: conn.fn.now() })

// Open invitations of a bar: { employeeId -> { email, expiresAt } }.
const pendingByEmployee = async (barId) => {
  const rows = await db('invites')
    .where({ bar_id: barId })
    .whereNull('accepted_at')
    .where('expires_at', '>', db.fn.now())
  return new Map(rows.map((row) => [row.employee_id, { email: row.email, expiresAt: row.expires_at.toISOString() }]))
}

module.exports = { INVITE_DAYS, create, findValid, markAccepted, pendingByEmployee }

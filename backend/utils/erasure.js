// Erasing a person's data on request (spec DATA-04, GDPR). The login account
// goes, and their name on the schedule is replaced, but their shifts stay so
// the bar's history is complete.
const db = require('../db/db')
const AuditLog = require('../models/auditLog')
const Users = require('../models/users')

// The name an erased person gets on the schedule, in the bar's language.
const FORMER_EMPLOYEE = { en: 'Former employee', fi: 'Entinen työntekijä' }

class ErasureError extends Error {}

const anonymiseRow = async (conn, barId, employeeId) => {
  const bar = await conn('bars').where({ id: barId }).first('locale')
  const name = `${FORMER_EMPLOYEE[bar.locale] ?? FORMER_EMPLOYEE.en} ${employeeId}`
  await conn('employees').where({ bar_id: barId, id: employeeId }).update({ name, anonymised_at: conn.fn.now() })
  await conn('invites').where({ bar_id: barId, employee_id: employeeId }).del()
}

// A manager erases one employee of their bar: their account in this bar (the
// account itself goes unless it belongs to another bar too), open
// invitations, and their name.
const anonymiseEmployee = (barId, employeeId, { actorUserId }) =>
  db.transaction(async (trx) => {
    const account = await Users.findByEmployee(barId, employeeId, trx)
    if (account) await Users.removeFromBar(barId, account.id, trx)
    await anonymiseRow(trx, barId, employeeId)
    const bar = await trx('bars').where({ id: barId }).first('organization_id')
    await AuditLog.add({ action: 'employee.anonymise', actorUserId, organizationId: bar.organization_id, barId, details: { employeeId } }, trx)
  })

// The platform admin erases a person everywhere: their account, their names
// on every bar's schedule, and invitations to their email. Refused for
// platform admins and for a bar's last manager, who must be replaced first.
const erasePerson = async (userId, { actorUserId }) => {
  const user = await db('users').where({ id: userId }).first()
  if (!user) throw new ErasureError('person not found')
  if (user.is_admin) throw new ErasureError('platform admins can\'t be erased here')

  const memberships = await db('memberships').where({ user_id: userId })
  for (const membership of memberships) {
    if (membership.role === 'employee') continue
    if ((await Users.countManagers(membership.bar_id)) <= 1) {
      throw new ErasureError('this person is the last manager of a bar; add another manager there first')
    }
  }

  await db.transaction(async (trx) => {
    for (const membership of memberships) {
      await Users.removeFromBar(membership.bar_id, userId, trx)
      if (membership.employee_id) await anonymiseRow(trx, membership.bar_id, membership.employee_id)
    }
    if (user.email) await trx('invites').where({ email: user.email }).del()
    // Accounts in no bar are already gone; this catches any left over.
    await trx('users').where({ id: userId }).del()
    // No name or email in the log: only that an erasure happened.
    for (const membership of memberships) {
      await AuditLog.add({ action: 'person.erase', actorUserId, barId: membership.bar_id, details: { userId } }, trx)
    }
    if (!memberships.length) await AuditLog.add({ action: 'person.erase', actorUserId, details: { userId } }, trx)
  })
}

module.exports = { FORMER_EMPLOYEE, ErasureError, anonymiseEmployee, erasePerson }

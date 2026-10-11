const db = require('../db/db')

// Security, admin and billing events (spec SEC-06, ADM-02): who did what, where.
// action: e.g. 'support.open'; details: anything worth keeping, as JSON.
const add = ({ action, actorUserId = null, organizationId = null, barId = null, details = {} }, conn = db) =>
  conn('audit_log').insert({
    action,
    actor_user_id: actorUserId,
    organization_id: organizationId,
    bar_id: barId,
    details: JSON.stringify(details)
  })

// The newest events of a bar first.
const listByBar = async (barId, limit = 50) => {
  const rows = await db('audit_log')
    .leftJoin('users', 'users.id', 'audit_log.actor_user_id')
    .where('audit_log.bar_id', barId)
    .orderBy('audit_log.created_at', 'desc')
    .orderBy('audit_log.id', 'desc')
    .limit(limit)
    .select('audit_log.*', 'users.name as actor_name')
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorName: row.actor_name ?? null,
    details: row.details,
    createdAt: row.created_at.toISOString()
  }))
}

module.exports = { add, listByBar }

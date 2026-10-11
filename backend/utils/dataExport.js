// Exporting data (spec DATA-01, DATA-04): everything of one bar for its
// owner, and everything about one person for a GDPR request. Password
// hashes and link tokens are never included.
const db = require('../db/db')
const config = require('./config')

const iso = (date) => date?.toISOString() ?? null

const accountOf = (row) => ({
  name: row.name,
  email: row.email,
  username: row.username,
  emailVerified: Boolean(row.email_verified_at),
  createdAt: iso(row.created_at),
  lastSeenAt: iso(row.last_seen_at)
})

const shiftOf = (row) => ({ id: row.id, employeeId: row.employee_id, start: iso(row.start), end: iso(row.end) })

// The whole bar as one JSON document.
const barExport = async (barId) => {
  const bar = await db('bars').where({ id: barId }).first()
  const organization = await db('organizations').where({ id: bar.organization_id }).first()
  const [employees, members, shifts, weeks, published, dayOrders, invites] = await Promise.all([
    db('employees').where({ bar_id: barId }).orderBy('id'),
    db('memberships').join('users', 'users.id', 'memberships.user_id').where('memberships.bar_id', barId).orderBy('users.name')
      .select('users.*', 'memberships.role', 'memberships.employee_id'),
    db('shifts').where({ bar_id: barId }).orderBy('start'),
    db('schedule_weeks').where({ bar_id: barId }).orderBy('week_start'),
    db('published_shifts').where({ bar_id: barId }).orderBy('start'),
    db('day_orders').where({ bar_id: barId }).orderBy('day'),
    db('invites').where({ bar_id: barId }).whereNull('accepted_at').orderBy('created_at')
  ])
  return {
    exportedAt: new Date().toISOString(),
    app: { name: 'myWorkSchedule', version: config.VERSION },
    organization: { name: organization.name, country: organization.country, subscriptionStatus: organization.subscription_status },
    bar: {
      name: bar.name,
      timezone: bar.timezone,
      opensAt: bar.opens_at.slice(0, 5),
      closesAt: bar.closes_at.slice(0, 5),
      locale: bar.locale,
      clock24h: bar.clock_24h,
      accentColor: bar.accent_color,
      createdAt: iso(bar.created_at)
    },
    employees: employees.map((row) => ({ id: row.id, name: row.name, role: row.role, color: row.color, anonymised: Boolean(row.anonymised_at) })),
    accounts: members.map((row) => ({ ...accountOf(row), role: row.role, employeeId: row.employee_id })),
    shifts: shifts.map(shiftOf),
    weeks: weeks.map((row) => ({ weekStart: row.week_start, status: row.status, lockedAt: iso(row.locked_at) })),
    publishedShifts: published.map((row) => ({ weekStart: row.week_start, shiftId: row.shift_id, employeeId: row.employee_id, start: iso(row.start), end: iso(row.end) })),
    dayOrders: dayOrders.map((row) => ({ day: row.day, employeeIds: row.employee_ids })),
    pendingInvites: invites.map((row) => ({ email: row.email, role: row.role, employeeId: row.employee_id, expiresAt: iso(row.expires_at) }))
  }
}

// A CSV field: quoted when needed, and safe to open in a spreadsheet (a
// leading =, +, - or @ would otherwise run as a formula).
const csvField = (value) => {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

// 'yyyy-MM-dd' and 'HH:mm' of a moment in the bar's timezone.
const localParts = (date, timezone) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(date).map((part) => [part.type, part.value])
  )
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` }
}

// Every shift of the bar as CSV, in the bar's local time, for spreadsheets.
const shiftsCsv = async (barId) => {
  const bar = await db('bars').where({ id: barId }).first('timezone')
  const rows = await db('shifts')
    .join('employees', 'employees.id', 'shifts.employee_id')
    .where('shifts.bar_id', barId)
    .orderBy('shifts.start')
    .select('shifts.start', 'shifts.end', 'employees.name', 'employees.role')
  const lines = [['date', 'start', 'end', 'hours', 'employee', 'role'].join(',')]
  for (const row of rows) {
    const start = localParts(row.start, bar.timezone)
    const end = localParts(row.end, bar.timezone)
    const hours = ((row.end - row.start) / 3600000).toFixed(2)
    lines.push([start.day, start.time, end.time, hours, row.name, row.role].map(csvField).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

// Everything stored about one person (GDPR access request): the account, the
// bars they belong to, their places on schedules with their shifts, open
// invitations to their email, and what they did according to the audit log.
const personExport = async (userId) => {
  const user = await db('users').where({ id: userId }).first()
  const memberships = await db('memberships').join('bars', 'bars.id', 'memberships.bar_id').where('memberships.user_id', userId)
    .select('memberships.*', 'bars.name as bar_name')
  const employeeIds = memberships.map((row) => row.employee_id).filter(Boolean)
  const [employees, shifts, invites, actions] = await Promise.all([
    db('employees').whereIn('id', employeeIds),
    db('shifts').whereIn('employee_id', employeeIds).orderBy('start'),
    user.email ? db('invites').where({ email: user.email }) : [],
    db('audit_log').where({ actor_user_id: userId }).orderBy('created_at')
  ])
  return {
    exportedAt: new Date().toISOString(),
    account: { ...accountOf(user), isAdmin: user.is_admin },
    memberships: memberships.map((row) => ({ bar: row.bar_name, role: row.role, employeeId: row.employee_id, since: iso(row.created_at) })),
    employees: employees.map((row) => ({ id: row.id, name: row.name, role: row.role })),
    shifts: shifts.map(shiftOf),
    invites: invites.map((row) => ({ email: row.email, role: row.role, createdAt: iso(row.created_at), acceptedAt: iso(row.accepted_at) })),
    auditLog: actions.map((row) => ({ action: row.action, details: row.details, at: iso(row.created_at) }))
  }
}

module.exports = { barExport, shiftsCsv, personExport, csvField }

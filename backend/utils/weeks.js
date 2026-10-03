// Schedule weeks. A shift belongs to the bar day it starts on, in the bar's
// timezone; when the bar closes after midnight (closes_at < opens_at), times
// before closing still belong to the previous day. A week runs Monday-Sunday
// and is identified by its Monday ('yyyy-MM-dd').
const db = require('../db/db')
const { isDayKey } = require('./validation')

// SQL for the week (a date, its Monday) of a timestamp column. The query must
// have the shift's bar joined as `bars`.
const weekOfSql = (column) => `date_trunc('week',
  (${column} AT TIME ZONE bars.timezone)
  - CASE WHEN bars.closes_at < bars.opens_at THEN bars.closes_at - time '00:00' ELSE interval '0' END
)::date`

// The week of a timestamp in the given bar.
const weekOf = async (barId, timestamp, conn = db) => {
  const { rows } = await conn.raw(
    `SELECT ${weekOfSql('?::timestamptz')} AS week FROM bars WHERE bars.id = ?`,
    [timestamp, barId]
  )
  return rows[0].week
}

const toKey = (date) => date.toISOString().slice(0, 10)

// The Monday of a calendar day ('yyyy-MM-dd'); plain date arithmetic.
const weekOfDay = (day) => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return toKey(date)
}

const addDays = (day, amount) => {
  const date = new Date(`${day}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return toKey(date)
}

const isWeekStart = (value) => isDayKey(value) && weekOfDay(value) === value

const lockedWeekResponse = (response, week) =>
  response.status(409).json({ error: `the week of ${week} is locked; unlock it to make changes` })

module.exports = { weekOfSql, weekOf, weekOfDay, addDays, isWeekStart, lockedWeekResponse }

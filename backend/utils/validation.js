// Parses an ISO timestamp string; returns a Date or null.
const parseTimestamp = (value) => {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const isDayKey = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())

const isId = (value) => Number.isInteger(value) && value > 0

module.exports = { parseTimestamp, isDayKey, isId }

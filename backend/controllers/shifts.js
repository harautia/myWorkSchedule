const shiftsRouter = require('express').Router()
const db = require('../db/db')
const Shifts = require('../models/shifts')
const Employees = require('../models/employees')
const ScheduleWeeks = require('../models/scheduleWeeks')
const { parseTimestamp, isId, parseId } = require('../utils/validation')
const { requireGroup } = require('../utils/middleware')
const { MANAGER } = require('../utils/groups')
const { weekOf, lockedWeekResponse } = require('../utils/weeks')

const MAX_SHIFT_HOURS = 24
// Upper limit for adding shifts in one go (about two months of days).
const MAX_BATCH = 62

// Checks a complete shift; returns an error message or null.
const validateShift = async (barId, { employeeId, start, end }) => {
  if (!isId(employeeId)) return 'employeeId must be a positive integer'
  if (!start || !end) return 'start and end must be ISO timestamps'
  if (end <= start) return 'end must be after start'
  if (end - start > MAX_SHIFT_HOURS * 60 * 60 * 1000) return `a shift can be at most ${MAX_SHIFT_HOURS} hours`
  // Also stops a client from assigning a shift to another bar's employee.
  if (!(await Employees.exists(barId, employeeId))) return 'unknown employee'
  return null
}

// The first locked week among the weeks of the given shift start times, or null.
const lockedWeekOf = async (barId, ...starts) => {
  for (const start of starts) {
    const week = await weekOf(barId, start)
    if (await ScheduleWeeks.isLocked(barId, week)) return week
  }
  return null
}

// GET /api/shifts?from=ISO&to=ISO -> shifts starting in [from, to). Managers
// see the live schedule; employees see the version of the last lock.
shiftsRouter.get('/', async (request, response) => {
  const from = parseTimestamp(request.query.from)
  const to = parseTimestamp(request.query.to)
  if (!from || !to) {
    return response.status(400).json({ error: 'from and to query parameters must be ISO timestamps' })
  }

  const shifts = request.user.groups.includes(MANAGER)
    ? await Shifts.getInRange(request.barId, from, to)
    : await ScheduleWeeks.publishedShifts(request.barId, from, to)
  response.json(shifts)
})

// Changing the schedule is for managers, and only in weeks that aren't
// locked; employees can only view it.
shiftsRouter.post('/', requireGroup(MANAGER), async (request, response) => {
  const shift = {
    employeeId: request.body.employeeId,
    start: parseTimestamp(request.body.start),
    end: parseTimestamp(request.body.end)
  }

  const error = await validateShift(request.barId, shift)
  if (error) return response.status(400).json({ error })
  const locked = await lockedWeekOf(request.barId, shift.start)
  if (locked) return lockedWeekResponse(response, locked)

  const created = await Shifts.create(request.barId, shift)
  response.status(201).json(created)
})

// Adds several shifts in one go: { shifts: [{ employeeId, start, end }, ...] }.
// All or nothing: if any shift is invalid or in a locked week, none is added.
shiftsRouter.post('/batch', requireGroup(MANAGER), async (request, response) => {
  const list = request.body.shifts
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_BATCH) {
    return response.status(400).json({ error: `shifts must be a list of 1-${MAX_BATCH} shifts` })
  }

  const shifts = list.map((shift) => ({
    employeeId: shift?.employeeId,
    start: parseTimestamp(shift?.start),
    end: parseTimestamp(shift?.end)
  }))
  for (const shift of shifts) {
    const error = await validateShift(request.barId, shift)
    if (error) return response.status(400).json({ error })
  }
  const locked = await lockedWeekOf(request.barId, ...shifts.map((shift) => shift.start))
  if (locked) return lockedWeekResponse(response, locked)

  const created = await db.transaction((trx) => Shifts.createMany(request.barId, shifts, trx))
  response.status(201).json(created)
})

// Partial update: any of employeeId, start, end.
shiftsRouter.put('/:id', requireGroup(MANAGER), async (request, response) => {
  const id = parseId(request.params.id)
  const existing = id && await Shifts.getById(request.barId, id)
  if (!existing) {
    return response.status(404).json({ error: 'shift not found' })
  }

  const { employeeId, start, end } = request.body
  const invalidTime = [start, end].some((value) => value !== undefined && !parseTimestamp(value))
  if (invalidTime) {
    return response.status(400).json({ error: 'start and end must be ISO timestamps' })
  }

  const merged = {
    employeeId: employeeId ?? existing.employeeId,
    start: parseTimestamp(start ?? existing.start),
    end: parseTimestamp(end ?? existing.end)
  }
  const error = await validateShift(request.barId, merged)
  if (error) return response.status(400).json({ error })
  // Neither out of nor into a locked week.
  const locked = await lockedWeekOf(request.barId, parseTimestamp(existing.start), merged.start)
  if (locked) return lockedWeekResponse(response, locked)

  const updated = await Shifts.update(request.barId, existing.id, merged)
  response.json(updated)
})

shiftsRouter.delete('/:id', requireGroup(MANAGER), async (request, response) => {
  const id = parseId(request.params.id)
  const existing = id && await Shifts.getById(request.barId, id)
  if (!existing) {
    return response.status(404).json({ error: 'shift not found' })
  }
  const locked = await lockedWeekOf(request.barId, parseTimestamp(existing.start))
  if (locked) return lockedWeekResponse(response, locked)

  await Shifts.remove(request.barId, id)
  response.status(204).end()
})

module.exports = shiftsRouter

const shiftsRouter = require('express').Router()
const Shifts = require('../models/shifts')
const Employees = require('../models/employees')
const { parseTimestamp, isId } = require('../utils/validation')

const MAX_SHIFT_HOURS = 24

// Route ids are strings; anything that isn't a positive integer can't match a shift.
const parseId = (value) => (/^\d+$/.test(value) ? Number(value) : null)

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

// GET /api/shifts?from=ISO&to=ISO -> shifts starting in [from, to)
shiftsRouter.get('/', async (request, response) => {
  const from = parseTimestamp(request.query.from)
  const to = parseTimestamp(request.query.to)
  if (!from || !to) {
    return response.status(400).json({ error: 'from and to query parameters must be ISO timestamps' })
  }

  const shifts = await Shifts.getInRange(request.barId, from, to)
  response.json(shifts)
})

shiftsRouter.post('/', async (request, response) => {
  const shift = {
    employeeId: request.body.employeeId,
    start: parseTimestamp(request.body.start),
    end: parseTimestamp(request.body.end)
  }

  const error = await validateShift(request.barId, shift)
  if (error) return response.status(400).json({ error })

  const created = await Shifts.create(request.barId, shift)
  response.status(201).json(created)
})

// Partial update: any of employeeId, start, end.
shiftsRouter.put('/:id', async (request, response) => {
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

  const updated = await Shifts.update(request.barId, existing.id, merged)
  response.json(updated)
})

shiftsRouter.delete('/:id', async (request, response) => {
  const id = parseId(request.params.id)
  const removed = id && await Shifts.remove(request.barId, id)
  if (!removed) {
    return response.status(404).json({ error: 'shift not found' })
  }
  response.status(204).end()
})

module.exports = shiftsRouter

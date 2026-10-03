const dayOrdersRouter = require('express').Router()
const DayOrders = require('../models/dayOrders')
const Employees = require('../models/employees')
const ScheduleWeeks = require('../models/scheduleWeeks')
const { isDayKey, isId } = require('../utils/validation')
const { requireGroup } = require('../utils/middleware')
const { MANAGER } = require('../utils/groups')
const { weekOfDay, lockedWeekResponse } = require('../utils/weeks')

// GET /api/day-orders[?from=yyyy-MM-dd&to=yyyy-MM-dd] -> { 'yyyy-MM-dd': [employeeId, ...] }
// Managers see the live orders; employees see the version of the last lock.
dayOrdersRouter.get('/', async (request, response) => {
  const { from, to } = request.query
  if ((from !== undefined && !isDayKey(from)) || (to !== undefined && !isDayKey(to))) {
    return response.status(400).json({ error: 'from and to must be dates (yyyy-MM-dd)' })
  }

  const dayOrders = request.user.groups.includes(MANAGER)
    ? await DayOrders.getAll(request.barId, from, to)
    : await ScheduleWeeks.publishedDayOrders(request.barId, from, to)
  response.json(dayOrders)
})

// PUT /api/day-orders/:day { order: [employeeId, ...] }
dayOrdersRouter.put('/:day', requireGroup(MANAGER), async (request, response) => {
  const { day } = request.params
  const { order } = request.body

  if (!isDayKey(day)) {
    return response.status(400).json({ error: 'day must be a date (yyyy-MM-dd)' })
  }
  if (!Array.isArray(order) || !order.every(isId) || new Set(order).size !== order.length) {
    return response.status(400).json({ error: 'order must be a list of distinct employee ids' })
  }

  const week = weekOfDay(day)
  if (await ScheduleWeeks.isLocked(request.barId, week)) return lockedWeekResponse(response, week)

  const barEmployeeIds = new Set((await Employees.getAll(request.barId)).map((e) => e.id))
  if (!order.every((id) => barEmployeeIds.has(id))) {
    return response.status(400).json({ error: 'unknown employee' })
  }

  const saved = await DayOrders.save(request.barId, day, order)
  response.json(saved)
})

module.exports = dayOrdersRouter

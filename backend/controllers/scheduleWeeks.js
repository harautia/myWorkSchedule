const scheduleWeeksRouter = require('express').Router()
const ScheduleWeeks = require('../models/scheduleWeeks')
const { isDayKey } = require('../utils/validation')
const { isWeekStart, weekOfDay } = require('../utils/weeks')
const { requireGroup } = require('../utils/middleware')
const { MANAGER } = require('../utils/groups')

// GET /api/schedule-weeks?from=yyyy-MM-dd&to=yyyy-MM-dd
// -> { 'yyyy-MM-dd' (Monday): { status, lockedAt, lockedBy, published } } for
// every week overlapping [from, to).
scheduleWeeksRouter.get('/', async (request, response) => {
  const { from, to } = request.query
  if (!isDayKey(from) || !isDayKey(to)) {
    return response.status(400).json({ error: 'from and to must be dates (yyyy-MM-dd)' })
  }

  response.json(await ScheduleWeeks.getInRange(request.barId, weekOfDay(from), to))
})

// Loads :week (its Monday) into request.week, or answers 400.
const parseWeek = (request, response, next) => {
  if (!isWeekStart(request.params.week)) {
    return response.status(400).json({ error: 'week must be the date of a Monday (yyyy-MM-dd)' })
  }
  request.week = request.params.week
  next()
}

// Locking publishes the week's current shifts to employees and stops changes.
scheduleWeeksRouter.post('/:week/lock', requireGroup(MANAGER), parseWeek, async (request, response) => {
  await ScheduleWeeks.lock(request.barId, request.week, request.user.id)
  response.json(await ScheduleWeeks.getWeek(request.barId, request.week))
})

// Unlocking allows changes again; employees keep seeing the locked version
// until the week is locked again.
scheduleWeeksRouter.post('/:week/unlock', requireGroup(MANAGER), parseWeek, async (request, response) => {
  await ScheduleWeeks.unlock(request.barId, request.week)
  response.json(await ScheduleWeeks.getWeek(request.barId, request.week))
})

module.exports = scheduleWeeksRouter

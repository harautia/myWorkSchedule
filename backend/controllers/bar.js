const barRouter = require('express').Router()
const Bars = require('../models/bars')
const { requireGroup } = require('../utils/middleware')
const { MANAGER } = require('../utils/groups')
const { barError, pickBarSettings } = require('../utils/validation')

// Settings of the current bar: name, timezone, opening hours, language,
// clock and accent colour. The app uses them for everything it shows.
barRouter.get('/', async (request, response) => {
  const bar = await Bars.getById(request.barId)
  if (!bar) {
    return response.status(404).json({ error: 'bar not found' })
  }
  response.json(bar)
})

// Managers change their own bar's settings; the bar is always their own.
barRouter.put('/', requireGroup(MANAGER), async (request, response) => {
  const settings = pickBarSettings(request.body)
  const error = barError(settings)
  if (error) return response.status(400).json({ error })

  await Bars.update(request.barId, settings)
  response.json(await Bars.getById(request.barId))
})

// The new bar's onboarding checklist for managers: which steps are done.
barRouter.get('/onboarding', requireGroup(MANAGER), async (request, response) => {
  response.json(await Bars.getOnboarding(request.barId))
})

// Hides the checklist for good.
barRouter.post('/onboarding/dismiss', requireGroup(MANAGER), async (request, response) => {
  await Bars.dismissOnboarding(request.barId)
  response.json(await Bars.getOnboarding(request.barId))
})

module.exports = barRouter

const barRouter = require('express').Router()
const Bars = require('../models/bars')

// Settings of the current bar (name, timezone, opening hours).
barRouter.get('/', async (request, response) => {
  const bar = await Bars.getById(request.barId)
  if (!bar) {
    return response.status(404).json({ error: 'bar not found' })
  }
  response.json(bar)
})

module.exports = barRouter

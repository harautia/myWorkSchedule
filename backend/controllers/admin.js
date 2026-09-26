const adminRouter = require('express').Router()
const Bars = require('../models/bars')

// All bars using the service, with employee and user counts.
adminRouter.get('/bars', async (request, response) => {
  const bars = await Bars.getAllWithCounts()
  response.json(bars)
})

module.exports = adminRouter

// Public endpoints that need no login.
const systemRouter = require('express').Router()
const db = require('../db/db')
const config = require('../utils/config')

// For Docker health checks and uptime monitoring: is the app up and can it
// reach the database?
systemRouter.get('/health', async (request, response) => {
  try {
    await db.raw('select 1')
    response.json({ status: 'ok', version: config.VERSION })
  } catch {
    response.status(503).json({ status: 'error', version: config.VERSION, error: 'database unavailable' })
  }
})

// What the app shows about this installation: version, who runs it, and where
// its source code is (required by the AGPL).
systemRouter.get('/app-info', (request, response) => {
  response.json({
    version: config.VERSION,
    deploymentMode: config.DEPLOYMENT_MODE,
    ...config.APP_INFO
  })
})

module.exports = systemRouter

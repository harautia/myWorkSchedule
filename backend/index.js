const app = require('./app')
const config = require('./utils/config')
const logger = require('./utils/logger')

// Express 5 passes listen errors (e.g. port already in use) to the callback.
app.listen(config.PORT, (error) => {
  if (error) throw error
  logger.info(`Server running on port ${config.PORT}`)
})

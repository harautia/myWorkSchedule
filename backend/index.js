const app = require('./app')
const db = require('./db/db')
const config = require('./utils/config')
const logger = require('./utils/logger')
const billing = require('./utils/billing')
const deletion = require('./utils/deletion')

const HOURLY_JOB_INTERVAL_MS = 60 * 60 * 1000

const start = async () => {
  // Refuse to start with settings that are unsafe or can't work.
  const problems = config.problems()
  if (problems.length) {
    problems.forEach((problem) => logger.error(`Configuration error: ${problem}`))
    process.exit(1)
  }

  if (config.MIGRATE_ON_START) {
    const [, applied] = await db.migrate.latest()
    if (applied.length) logger.info(`Applied database migrations: ${applied.join(', ')}`)
  }

  // The hourly jobs: the hosted service's billing (locking bars after their
  // read-only period, the trial and deletion reminders), then deleting bars
  // whose deletion date has passed (every copy).
  const runHourlyJobs = async () => {
    for (const [name, job] of [['Billing', billing.runJobs], ['Deletion', deletion.runJobs]]) {
      try {
        const done = await job()
        if (Object.values(done).some(Boolean)) logger.info(`${name} job:`, JSON.stringify(done))
      } catch (error) {
        logger.error(`${name} job failed: ${error.message}`)
      }
    }
  }
  runHourlyJobs()
  setInterval(runHourlyJobs, HOURLY_JOB_INTERVAL_MS).unref()

  // Express 5 passes listen errors (e.g. port already in use) to the callback.
  const server = app.listen(config.PORT, (error) => {
    if (error) throw error
    logger.info(`myWorkSchedule ${config.VERSION} (${config.DEPLOYMENT_MODE}) running on port ${config.PORT}`)
  })

  // Docker and most hosts send SIGTERM to stop; finish open requests first.
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`)
    server.close(() => db.destroy().then(() => process.exit(0)))
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch((error) => {
  logger.error('Failed to start:', error.message)
  process.exit(1)
})

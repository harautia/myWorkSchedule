const express = require('express')
const helmet = require('helmet')
const middleware = require('./utils/middleware')
const { resolveBar } = require('./utils/tenant')
const barRouter = require('./controllers/bar')
const employeesRouter = require('./controllers/employees')
const shiftsRouter = require('./controllers/shifts')
const dayOrdersRouter = require('./controllers/dayOrders')

const app = express()

// CSP is left off: a correct policy for the Vite-built frontend needs
// testing against the actual production bundle, which is out of scope here.
app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json())
app.use(express.static('dist'))
app.use(middleware.requestLogger)

// Every /api route acts on exactly one bar, set by resolveBar.
app.use('/api', resolveBar)
app.use('/api/bar', barRouter)
app.use('/api/employees', employeesRouter)
app.use('/api/shifts', shiftsRouter)
app.use('/api/day-orders', dayOrdersRouter)

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app

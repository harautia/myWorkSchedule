const express = require('express')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const middleware = require('./utils/middleware')
const { resolveBar } = require('./utils/tenant')
const { ADMIN, MANAGER, EMPLOYEE } = require('./utils/groups')
const authRouter = require('./controllers/auth')
const adminRouter = require('./controllers/admin')
const barRouter = require('./controllers/bar')
const employeesRouter = require('./controllers/employees')
const shiftsRouter = require('./controllers/shifts')
const dayOrdersRouter = require('./controllers/dayOrders')
const scheduleWeeksRouter = require('./controllers/scheduleWeeks')

const app = express()

// Behind a hosting proxy (e.g. Render) this gives the real client IP to the
// login rate limiter.
app.set('trust proxy', 1)

// CSP is left off: a correct policy for the Vite-built frontend needs
// testing against the actual production bundle, which is out of scope here.
app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json())
app.use(cookieParser())
app.use(express.static('dist'))
app.use(middleware.requestLogger)

// /api/login, /api/logout and /api/me
app.use('/api', authRouter)

// Across all bars: admins only.
app.use('/api/admin', middleware.requireAuth, middleware.requireGroup(ADMIN), adminRouter)

// One bar's data: managers and employees of that bar. resolveBar sets
// request.barId from the user; write routes additionally require managerGroup.
const barMember = [middleware.requireAuth, middleware.requireGroup(MANAGER, EMPLOYEE), resolveBar]
app.use('/api/bar', barMember, barRouter)
app.use('/api/employees', barMember, employeesRouter)
app.use('/api/shifts', barMember, shiftsRouter)
app.use('/api/day-orders', barMember, dayOrdersRouter)
app.use('/api/schedule-weeks', barMember, scheduleWeeksRouter)

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app

const express = require('express')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const middleware = require('./utils/middleware')
const { resolveBar } = require('./utils/tenant')
const { ADMIN, MANAGER, EMPLOYEE } = require('./utils/groups')
const systemRouter = require('./controllers/system')
const authRouter = require('./controllers/auth')
const accountLinksRouter = require('./controllers/accountLinks')
const signupRouter = require('./controllers/signup')
const billingRouter = require('./controllers/billing')
const stripeWebhookRouter = require('./controllers/stripeWebhook')
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
// Before express.json(): Stripe's signature is checked against the raw body.
app.use('/api/stripe/webhook', stripeWebhookRouter)
app.use(express.json())
app.use(cookieParser())
app.use(express.static('dist'))
app.use(middleware.requestLogger)

// /api/health and /api/app-info, public
app.use('/api', systemRouter)

// /api/login, /api/logout and /api/me
app.use('/api', authRouter)

// /api/invites/:token and /api/password-reset, public (links sent by email)
app.use('/api', accountLinksRouter)

// /api/signup and /api/verify-email
app.use('/api', signupRouter)

// Across all bars: admins only.
app.use('/api/admin', middleware.requireAuth, middleware.requireGroup(ADMIN), adminRouter)

// One bar's data: managers and employees of that bar. resolveBar sets
// request.barId from the user; write routes additionally require managerGroup.
// An admin in support mode may only read; on the hosted service the bar's
// subscription decides what it may do.
const barUser = [middleware.requireAuth, middleware.requireGroup(MANAGER, EMPLOYEE), resolveBar]
const barMember = [...barUser, middleware.readOnlyInSupport, middleware.requireSubscription]

// The owner's billing page; open even when the subscription isn't.
app.use('/api/billing', barUser, billingRouter)

app.use('/api/bar', barMember, barRouter)
app.use('/api/employees', barMember, employeesRouter)
app.use('/api/shifts', barMember, shiftsRouter)
app.use('/api/day-orders', barMember, dayOrdersRouter)
app.use('/api/schedule-weeks', barMember, scheduleWeeksRouter)

app.use(middleware.unknownEndpoint)
app.use(middleware.errorHandler)

module.exports = app

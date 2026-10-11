const barRouter = require('express').Router()
const Bars = require('../models/bars')
const AuditLog = require('../models/auditLog')
const dataExport = require('../utils/dataExport')
const deletion = require('../utils/deletion')
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

// The account owner exports and deletes the bar (spec DATA-01-02); in support
// mode nobody does.
const requireOwner = (request, response, next) => {
  if (request.user.role !== 'owner' || request.user.supportMode) {
    return response.status(403).json({ error: 'only the account owner can do this' })
  }
  next()
}

const UTF8_BOM = String.fromCharCode(0xfeff)

const exportFileName = (bar, extension) =>
  `${bar.name.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'bar'}-${new Date().toISOString().slice(0, 10)}.${extension}`

// ?format=json (everything) or csv (the shifts, for spreadsheets). Works when
// the bar is locked too, so the data can be taken along.
barRouter.get('/export', requireOwner, async (request, response) => {
  const bar = await Bars.getById(request.barId)
  const format = request.query.format === 'csv' ? 'csv' : 'json'
  await AuditLog.add({ action: 'bar.export', actorUserId: request.user.id, organizationId: request.user.organizationId, barId: request.barId, details: { format } })
  response.attachment(exportFileName(bar, format))
  if (format === 'csv') {
    // The byte order mark makes Excel read the file as UTF-8 (ä, ö).
    response.type('text/csv; charset=utf-8').send(UTF8_BOM + await dataExport.shiftsCsv(request.barId))
  } else {
    response.json(await dataExport.barExport(request.barId))
  }
})

// { confirmName }: schedules the bar's deletion in 30 days. The bar keeps
// working until then, and the deletion can be undone.
barRouter.post('/deletion', requireOwner, async (request, response) => {
  const bar = await Bars.getById(request.barId)
  if (typeof request.body.confirmName !== 'string' || request.body.confirmName.trim() !== bar.name) {
    return response.status(400).json({ error: 'type the bar\'s name to confirm' })
  }
  if (bar.scheduledDeletionAt) return response.status(409).json({ error: 'the bar is already scheduled for deletion' })
  await deletion.scheduleBarDeletion(request.barId, { actorUserId: request.user.id })
  response.json(await Bars.getById(request.barId))
})

// Undoes a scheduled deletion.
barRouter.delete('/deletion', requireOwner, async (request, response) => {
  await deletion.cancelBarDeletion(request.barId, { actorUserId: request.user.id })
  response.json(await Bars.getById(request.barId))
})

module.exports = barRouter

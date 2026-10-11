import api from './api'

// adminGroup only.
// bar = { id, name, timezone, opensAt, closesAt }
// details = { bar, users: [{ id, username, name, groups, role, employee, createdAt }] }

// Every bar using the service, with employee/user counts.
const getBars = () => api.get('/admin/bars').then((res) => res.data)

const getBar = (barId) => api.get(`/admin/bars/${barId}`).then((res) => res.data)

// Creates a bar with its first manager; returns the new bar's details.
const createBar = (bar, manager) => api.post('/admin/bars', { bar, manager }).then((res) => res.data)

const updateBar = (barId, bar) => api.put(`/admin/bars/${barId}`, bar).then((res) => res.data)

// Deletes the bar with all its employees, shifts and user accounts.
const deleteBar = (barId) => api.delete(`/admin/bars/${barId}`)

const addManager = (barId, manager) =>
  api.post(`/admin/bars/${barId}/managers`, manager).then((res) => res.data)

// changes = { name?, password? }. A new password also logs the manager out everywhere.
const updateManager = (barId, userId, changes) =>
  api.put(`/admin/bars/${barId}/managers/${userId}`, changes).then((res) => res.data)

const removeManager = (barId, userId) => api.delete(`/admin/bars/${barId}/managers/${userId}`)

// Every organization with its bars, subscription status, trial end, active
// users and last activity. filters = { search?, status? } ('none' = no status).
const getOrganizations = ({ search = '', status = '' } = {}) =>
  api.get('/admin/organizations', { params: { search: search || undefined, status: status || undefined } }).then((res) => res.data)

// Opens the bar in read-only support mode; the reason goes to the audit log.
const openSupport = (barId, reason) => api.post(`/admin/bars/${barId}/support`, { reason })

const leaveSupport = () => api.delete('/admin/support')

// The bar's audit log, newest first: [{ id, action, actorName, details, createdAt }]
const getAuditLog = (barId) => api.get(`/admin/bars/${barId}/audit`).then((res) => res.data)

export default {
  getBars,
  getBar,
  createBar,
  updateBar,
  deleteBar,
  addManager,
  updateManager,
  removeManager,
  getOrganizations,
  openSupport,
  leaveSupport,
  getAuditLog
}

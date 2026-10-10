import api from './api'

// managerGroup only. An employee in details:
// { id, name, role, color, account: { username, email, groups } | null,
//   invite: { email, expiresAt } | null, shiftCount }

// The bar's employees with their login account (or null) and shift count.
const getDetails = () => api.get('/employees/details').then((res) => res.data)

// Adds a waiter and invites them by email: { name, email }. The answer has
// inviteSent: { email, sent, url? }; url is the link to pass on when the
// server can't send email.
const create = (person) => api.post('/employees', person).then((res) => res.data)

// Invites (again) an employee who has no login yet: { email, sent, url? }.
const invite = (id, email) => api.post(`/employees/${id}/invite`, email ? { email } : {}).then((res) => res.data)

// changes = { name?, email?, password? }. A new password also logs the employee out everywhere.
const update = (id, changes) => api.put(`/employees/${id}`, changes).then((res) => res.data)

// Deletes the employee, their login account and all their shifts.
const remove = (id) => api.delete(`/employees/${id}`)

export default { getDetails, create, invite, update, remove }

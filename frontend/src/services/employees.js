import api from './api'

// managerGroup only. An employee in details:
// { id, name, role, color, account: { username, groups } | null, shiftCount }

// The bar's employees with their login account (or null) and shift count.
const getDetails = () => api.get('/employees/details').then((res) => res.data)

// Adds a waiter with an employeeGroup login: { username, name, password }
const create = (account) => api.post('/employees', account).then((res) => res.data)

// changes = { name?, password? }. A new password also logs the employee out everywhere.
const update = (id, changes) => api.put(`/employees/${id}`, changes).then((res) => res.data)

// Deletes the employee, their login account and all their shifts.
const remove = (id) => api.delete(`/employees/${id}`)

export default { getDetails, create, update, remove }

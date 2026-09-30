import api from './api'

const getEmployees = () => api.get('/employees').then((res) => res.data)

// Shifts starting in [from, to)
const getShifts = (from, to) =>
  api
    .get('/shifts', { params: { from: from.toISOString(), to: to.toISOString() } })
    .then((res) => res.data)

// shift = { employeeId, start, end } with ISO timestamps
const createShift = (shift) => api.post('/shifts', shift).then((res) => res.data)

const updateShift = (id, changes) => api.put(`/shifts/${id}`, changes).then((res) => res.data)

const deleteShift = (id) => api.delete(`/shifts/${id}`)

// Side-by-side employee order per day: { 'yyyy-MM-dd': [employeeId, ...] }
const getDayOrders = () => api.get('/day-orders').then((res) => res.data)

const saveDayOrder = (key, order) =>
  api.put(`/day-orders/${key}`, { order }).then((res) => res.data)

export default { getEmployees, getShifts, createShift, updateShift, deleteShift, getDayOrders, saveDayOrder }

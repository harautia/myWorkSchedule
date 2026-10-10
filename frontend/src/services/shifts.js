import api from './api'
import { toApiTime } from '../utils/dates'

const getEmployees = () => api.get('/employees').then((res) => res.data)

// The logged-in user's own shifts starting in [from, to) (published ones for employees).
const getMyShifts = (from, to) =>
  api
    .get('/shifts/mine', { params: { from: toApiTime(from), to: toApiTime(to) } })
    .then((res) => res.data)

// Shifts starting in [from, to)
const getShifts = (from, to) =>
  api
    .get('/shifts', { params: { from: toApiTime(from), to: toApiTime(to) } })
    .then((res) => res.data)

// One or more shifts in one go, all or nothing: [{ employeeId, start, end }, ...]
// with ISO timestamps.
const createShifts = (shifts) => api.post('/shifts/batch', { shifts }).then((res) => res.data)

const updateShift = (id, changes) => api.put(`/shifts/${id}`, changes).then((res) => res.data)

const deleteShift = (id) => api.delete(`/shifts/${id}`)

// Side-by-side employee order per day: { 'yyyy-MM-dd': [employeeId, ...] }
const getDayOrders = () => api.get('/day-orders').then((res) => res.data)

const saveDayOrder = (key, order) =>
  api.put(`/day-orders/${key}`, { order }).then((res) => res.data)

// Week statuses (keyed by Monday) for weeks overlapping [from, to):
// { 'yyyy-MM-dd': { status: 'planning' | 'locked', lockedAt, lockedBy, published } }
const getWeeks = (from, to) => api.get('/schedule-weeks', { params: { from, to } }).then((res) => res.data)

// Locking publishes the week to employees and stops changes.
const lockWeek = (week) => api.post(`/schedule-weeks/${week}/lock`).then((res) => res.data)

// Allows changes again; employees keep seeing the locked version until it is locked again.
const unlockWeek = (week) => api.post(`/schedule-weeks/${week}/unlock`).then((res) => res.data)

export default { getEmployees, getShifts, getMyShifts, createShifts, updateShift, deleteShift, getWeeks, lockWeek, unlockWeek, getDayOrders, saveDayOrder }

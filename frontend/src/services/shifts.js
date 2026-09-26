import { dayOrders, employees, shifts } from '../data/mockData'

// Mock implementations. When the backend exists these become e.g.
//   api.get('/shifts', { params: { from, to } }).then((res) => res.data)

const getEmployees = () => Promise.resolve(employees)

const getShifts = (from, to) =>
  Promise.resolve(
    shifts.filter((shift) => {
      const start = new Date(shift.start)
      return start >= from && start < to
    })
  )

// Later: api.put(`/shifts/${id}`, changes)
const updateShift = (id, changes) => {
  const shift = shifts.find((s) => s.id === id)
  Object.assign(shift, changes)
  return Promise.resolve({ ...shift })
}

// Side-by-side employee order per day: { 'yyyy-MM-dd': [employeeId, ...] }
const getDayOrders = () => Promise.resolve({ ...dayOrders })

// Later: api.put(`/day-orders/${key}`, { order })
const saveDayOrder = (key, order) => {
  dayOrders[key] = order
  return Promise.resolve(order)
}

export default { getEmployees, getShifts, updateShift, getDayOrders, saveDayOrder }

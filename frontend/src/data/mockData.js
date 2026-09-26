import { addDays, addHours } from 'date-fns'
import { weekStart } from '../utils/dates'

export const employees = [
  { id: 1, name: 'Anna', role: 'manager', color: '#863bff' },
  { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' },
  { id: 3, name: 'Liisa', role: 'waiter', color: '#0ca678' },
  { id: 4, name: 'Jukka', role: 'waiter', color: '#e8590c' },
  { id: 5, name: 'Sanna', role: 'waiter', color: '#d6336c' },
  { id: 6, name: 'Pekka', role: 'waiter', color: '#5c940d' },
  { id: 7, name: 'Emma', role: 'waiter', color: '#c2255c' }
]

// Weekly rota template: [dayIndex (0 = Mon), employeeId, startHour, lengthHours]
const TEMPLATE = [
  [0, 1, 10, 8], [0, 4, 11, 8], [0, 2, 16, 8], [0, 5, 17, 7],
  [1, 1, 10, 8], [1, 7, 11, 8], [1, 3, 16, 8], [1, 6, 17, 7],
  [2, 1, 10, 8], [2, 4, 11, 8], [2, 2, 16, 8], [2, 5, 17, 7],
  [3, 1, 12, 8], [3, 7, 11, 8], [3, 3, 16, 8], [3, 6, 18, 6], [3, 2, 20, 8],
  [4, 1, 14, 8], [4, 4, 11, 8], [4, 7, 16, 8], [4, 2, 18, 10], [4, 3, 18, 10], [4, 5, 17, 9], [4, 6, 19, 8],
  [5, 4, 11, 8], [5, 7, 16, 8], [5, 2, 18, 10], [5, 3, 18, 10], [5, 5, 17, 9], [5, 6, 19, 8], [5, 1, 20, 6],
  [6, 1, 12, 6], [6, 4, 12, 6], [6, 3, 14, 8], [6, 6, 14, 8]
]

// Generates shifts for the previous, current and next four weeks so the
// calendar always has something to show. Shape matches the future API.
const buildShifts = () => {
  const base = addDays(weekStart(new Date()), -7)
  const shifts = []
  for (let week = 0; week < 6; week++) {
    TEMPLATE.forEach(([day, employeeId, startHour, length]) => {
      const start = addHours(addDays(base, week * 7 + day), startHour)
      shifts.push({
        id: shifts.length + 1,
        employeeId,
        start: start.toISOString(),
        end: addHours(start, length).toISOString()
      })
    })
  }
  return shifts
}

export const shifts = buildShifts()

// Custom side-by-side order of employees per day, empty = legend order.
export const dayOrders = {}

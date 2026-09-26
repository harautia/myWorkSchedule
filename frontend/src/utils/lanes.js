import { format } from 'date-fns'
import { barDay, isSameDay } from './dates'

// Side-by-side ordering of employees inside a day in the week view. Each day
// can have its own saved order (an array of employee ids); employees without a
// saved position follow in employee (legend) order.

export const dayKey = (day) => format(day, 'yyyy-MM-dd')

export const shiftsOnDay = (shifts, day) =>
  shifts.filter((shift) => isSameDay(barDay(shift.start), day))

export const employeeOrder = (dayShifts, savedOrder = []) => {
  const rank = (id) => {
    const index = savedOrder.indexOf(id)
    return index === -1 ? Infinity : index
  }
  return [...new Set(dayShifts.map((s) => s.employeeId))].sort(
    (a, b) => rank(a) - rank(b) || a - b
  )
}

// One lane per employee; returns [{ shift, lane, lanes }].
export const layoutLanes = (dayShifts, order) =>
  dayShifts.map((shift) => ({
    shift,
    lane: order.indexOf(shift.employeeId),
    lanes: order.length
  }))

// The order after dropping employeeId at position lane.
export const insertAt = (order, employeeId, lane) => {
  const rest = order.filter((id) => id !== employeeId)
  rest.splice(Math.min(Math.max(lane, 0), rest.length), 0, employeeId)
  return rest
}

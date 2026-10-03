import {
  addDays,
  addHours,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subHours
} from 'date-fns'

// The bar opens at 10:00 and closes at 04:00 the next morning. A "bar day"
// therefore runs from DAY_START_HOUR to DAY_END_HOUR (past midnight = > 24).
export const DAY_START_HOUR = 10
export const DAY_END_HOUR = 28

const WEEK_OPTIONS = { weekStartsOn: 1 } // Monday

export { addDays, isSameDay, isSameMonth }

export const weekStart = (date) => startOfWeek(date, WEEK_OPTIONS)

export const weekDays = (date) => {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// 6 full weeks covering the month, starting on the Monday on/before the 1st.
export const monthGrid = (date) => {
  const start = weekStart(startOfMonth(date))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export const visibleRange = (view, date) => {
  const days = view === 'week' ? weekDays(date) : monthGrid(date)
  return { from: days[0], to: addDays(days[days.length - 1], 1) }
}

export const shiftDate = (view, date, amount) =>
  view === 'week' ? addWeeks(date, amount) : addMonths(date, amount)

// A shift starting at 01:00 still belongs to the previous evening's bar day.
export const barDay = (date) => startOfDay(subHours(date, DAY_END_HOUR - 24))

export const barDayStart = (day) => addHours(startOfDay(day), DAY_START_HOUR)

// Hours from the bar day's opening time, clamped to the visible hours.
export const hoursFromOpening = (day, date) => {
  const hours = differenceInMinutes(date, barDayStart(day)) / 60
  return Math.min(Math.max(hours, 0), DAY_END_HOUR - DAY_START_HOUR)
}

// The moment 'HH:mm' happens on a bar day. Times before opening are after
// midnight, i.e. on the next calendar day (02:00 on Monday = Tuesday 02:00).
export const timeOnBarDay = (day, time) => {
  const [hours, minutes] = time.split(':').map(Number)
  const base = addMinutes(startOfDay(day), hours * 60 + minutes)
  return hours < DAY_START_HOUR ? addDays(base, 1) : base
}

export const formatTime = (date) => format(date, 'HH:mm')
export const formatShortTime = (date) => format(date, date.getMinutes() ? 'HH:mm' : 'HH')
export const formatDateTime = (date) => format(date, 'd.M. HH:mm')
export const formatDayHeader = (date) => format(date, 'EEE d.M.')

export const formatRangeLabel = (view, date) => {
  if (view === 'month') return format(date, 'MMMM yyyy')
  const days = weekDays(date)
  return `${format(days[0], 'd.M.')} – ${format(days[6], 'd.M.yyyy')}`
}

export const SNAP_MINUTES = 15
const MIN_SHIFT_MINUTES = 30
export const OPEN_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

export const snapMinutes = (minutes) => Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES

// New { start, end } for a shift being dragged. 'move' shifts it by days and
// minutes keeping its length; 'resize' moves only the end. The result always
// stays inside the given days and the bar's opening hours.
export const adjustShift = (shift, { mode, dayDelta = 0, minutesDelta, days }) => {
  const day = barDay(shift.start)
  const startMin = hoursFromOpening(day, shift.start) * 60
  const endMin = hoursFromOpening(day, shift.end) * 60

  if (mode === 'resize') {
    const newEnd = clamp(endMin + minutesDelta, startMin + MIN_SHIFT_MINUTES, OPEN_MINUTES)
    return { start: shift.start, end: addMinutes(barDayStart(day), newEnd) }
  }

  const index = days.findIndex((d) => isSameDay(d, day))
  const targetDay = days[clamp(index + dayDelta, 0, days.length - 1)]
  const duration = endMin - startMin
  const newStart = clamp(startMin + minutesDelta, 0, OPEN_MINUTES - duration)
  const base = barDayStart(targetDay)
  return { start: addMinutes(base, newStart), end: addMinutes(base, newStart + duration) }
}

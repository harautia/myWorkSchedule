import { TZDate } from '@date-fns/tz'
import { fi } from 'date-fns/locale'
import {
  addDays,
  addMinutes,
  addMonths,
  addWeeks,
  differenceInMinutes,
  format,
  isSameDay,
  isSameMonth,
  set,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMinutes
} from 'date-fns'

// The bar whose schedule is shown. Every function here works in the bar's
// timezone and with its opening hours, wherever the user happens to be.
// setBarSettings() is called when the bar's settings have loaded.
const localTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone

let bar = { timezone: localTimezone(), opensAt: '10:00', closesAt: '04:00', clock24h: true, locale: 'en' }

export const setBarSettings = ({ timezone, opensAt, closesAt, clock24h = true, locale = 'en' }) => {
  bar = { timezone, opensAt, closesAt, clock24h, locale }
}

// Weekday and month names in the bar's language (date-fns defaults to English).
const DATE_LOCALES = { fi }
const withLocale = () => ({ locale: DATE_LOCALES[bar.locale] })

// Finnish calendars use two-letter weekdays (ma, ti); date-fns's 'EEE' would
// give 'maan.'. English keeps 'Mon'.
const localPattern = (pattern) =>
  bar.locale === 'fi' ? pattern.replace(/(^|[^E])EEE(?!E)/g, '$1EEEEEE') : pattern

const MINUTES_PER_DAY = 24 * 60
const toMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

// A bar day runs from opening to closing, which may be after midnight:
// 10:00-04:00 is minutes 600-1680 of the day the bar opened.
const opensMinutes = () => toMinutes(bar.opensAt)
const closesMinutes = () => {
  const closes = toMinutes(bar.closesAt)
  return closes <= opensMinutes() ? closes + MINUTES_PER_DAY : closes
}
const isOvernight = () => closesMinutes() > MINUTES_PER_DAY

// Minutes from opening to closing.
export const openMinutes = () => closesMinutes() - opensMinutes()

// The same moment in the bar's timezone. Accepts a Date, an ISO string or a timestamp.
export const inBarTime = (date) => new TZDate(new Date(date).getTime(), bar.timezone)

export const barNow = () => inBarTime(Date.now())

// A moment as a UTC ISO string for the API ('…Z'). A bar time's own
// toISOString() would carry the bar's offset instead (e.g. '…-04:00').
export const toApiTime = (date) => new Date(new Date(date).getTime()).toISOString()

// Midnight starting the calendar day 'yyyy-MM-dd', in the bar's timezone.
export const fromDayKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new TZDate(year, month - 1, day, bar.timezone)
}

// The wall-clock time `minutes` after midnight of `day` (may be the next day).
// Set directly, so a day when the clocks change still opens at the right time.
const atMinutes = (day, minutes) => {
  const date = minutes >= MINUTES_PER_DAY ? addDays(day, 1) : day
  const inDay = minutes % MINUTES_PER_DAY
  return set(date, { hours: Math.floor(inDay / 60), minutes: inDay % 60, seconds: 0, milliseconds: 0 })
}

const WEEK_OPTIONS = { weekStartsOn: 1 } // Monday

export { addDays, isSameDay, isSameMonth }

export const weekStart = (date) => startOfWeek(inBarTime(date), WEEK_OPTIONS)

export const weekDays = (date) => {
  const start = weekStart(date)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// 6 full weeks covering the month, starting on the Monday on/before the 1st.
export const monthGrid = (date) => {
  const start = weekStart(startOfMonth(inBarTime(date)))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

// The "My shifts" list shows this many weeks at a time.
export const AGENDA_WEEKS = 4

// The weeks (their Mondays) of the "My shifts" list starting from date's week.
export const agendaWeeks = (date) =>
  Array.from({ length: AGENDA_WEEKS }, (_, i) => addWeeks(weekStart(date), i))

// Views: 'mine' (My shifts list), 'week', 'month'.
export const visibleRange = (view, date) => {
  if (view === 'mine') return { from: weekStart(date), to: addWeeks(weekStart(date), AGENDA_WEEKS) }
  const days = view === 'week' ? weekDays(date) : monthGrid(date)
  return { from: days[0], to: addDays(days[days.length - 1], 1) }
}

export const shiftDate = (view, date, amount) => {
  if (view === 'mine') return addWeeks(date, amount * AGENDA_WEEKS)
  return view === 'week' ? addWeeks(date, amount) : addMonths(date, amount)
}

// The bar day a moment belongs to. When the bar closes after midnight, a
// shift starting at 01:00 still belongs to the previous evening's bar day.
export const barDay = (date) =>
  startOfDay(subMinutes(inBarTime(date), Math.max(closesMinutes() - MINUTES_PER_DAY, 0)))

// Opening time of a bar day.
export const barDayStart = (day) => atMinutes(startOfDay(inBarTime(day)), opensMinutes())

// Hours from the bar day's opening time, clamped to the opening hours.
export const hoursFromOpening = (day, date) => {
  const hours = differenceInMinutes(date, barDayStart(day)) / 60
  return Math.min(Math.max(hours, 0), openMinutes() / 60)
}

// The moment 'HH:mm' happens on a bar day. In a bar open past midnight, times
// before opening are after midnight, i.e. on the next calendar day
// (02:00 on Monday = Tuesday 02:00).
export const timeOnBarDay = (day, time) => {
  const minutes = toMinutes(time)
  const nextDay = isOvernight() && minutes < opensMinutes()
  return atMinutes(startOfDay(inBarTime(day)), nextDay ? minutes + MINUTES_PER_DAY : minutes)
}

// Times follow the bar's clock setting: 18:30 or 6:30 PM.
const timePattern = () => (bar.clock24h ? 'HH:mm' : 'h:mm a')
const shortTimePattern = (date) => {
  if (bar.clock24h) return date.getMinutes() ? 'HH:mm' : 'HH'
  return date.getMinutes() ? 'h:mma' : 'ha'
}

// Any date in the bar's timezone and language, e.g. formatDate(day, 'EEE d.M.').
export const formatDate = (date, pattern) => format(inBarTime(date), localPattern(pattern), withLocale())

// Short weekday names in the bar's language, Monday first: Mon … Sun / ma … su.
export const weekdayNames = () => weekDays(barNow()).map((day) => formatDate(day, 'EEE'))

// Value for an <input type="time">, which always takes 24-hour 'HH:mm',
// whatever the bar's clock setting.
export const toTimeInput = (date) => format(inBarTime(date), 'HH:mm')

export const formatTime = (date) => format(inBarTime(date), timePattern(), withLocale())
export const formatShortTime = (date) => {
  const local = inBarTime(date)
  return format(local, shortTimePattern(local), withLocale())
}
export const formatDateTime = (date) => format(inBarTime(date), `d.M. ${timePattern()}`, withLocale())
export const formatDayHeader = (date) => formatDate(date, 'EEE d.M.')

// Labels for the hour rows of the week view: one per hour from opening.
export const openingHourLabels = () => {
  const day = startOfDay(barNow())
  return Array.from({ length: Math.ceil(openMinutes() / 60) }, (_, i) =>
    format(atMinutes(day, (opensMinutes() + i * 60) % MINUTES_PER_DAY), timePattern(), withLocale())
  )
}

export const formatRangeLabel = (view, date) => {
  if (view === 'month') return format(date, 'MMMM yyyy', withLocale())
  const { from, to } = visibleRange(view, date)
  return `${format(from, 'd.M.', withLocale())} – ${format(addDays(to, -1), 'd.M.yyyy', withLocale())}`
}

export const SNAP_MINUTES = 15
const MIN_SHIFT_MINUTES = 30

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
    const newEnd = clamp(endMin + minutesDelta, startMin + MIN_SHIFT_MINUTES, openMinutes())
    return { start: shift.start, end: addMinutes(barDayStart(day), newEnd) }
  }

  const index = days.findIndex((d) => isSameDay(d, day))
  const targetDay = days[clamp(index + dayDelta, 0, days.length - 1)]
  const duration = endMin - startMin
  const newStart = clamp(startMin + minutesDelta, 0, openMinutes() - duration)
  const base = barDayStart(targetDay)
  return { start: addMinutes(base, newStart), end: addMinutes(base, newStart + duration) }
}

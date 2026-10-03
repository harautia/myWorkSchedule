import { useCallback, useEffect, useMemo, useState } from 'react'
import CalendarToolbar from './CalendarToolbar'
import EmployeeLegend from './EmployeeLegend'
import MonthView from './MonthView'
import NewShiftForm from './NewShiftForm'
import WeekStatusBar from './WeekStatusBar'
import WeekView from './WeekView'
import shiftService from '../services/shifts'
import {
  formatRangeLabel,
  formatTime,
  isSameDay,
  monthGrid,
  shiftDate,
  visibleRange,
  weekDays,
  weekStart
} from '../utils/dates'
import { dayKey } from '../utils/lanes'
import { errorMessage } from '../utils/forms'

const toShift = (data) => ({ ...data, start: new Date(data.start), end: new Date(data.end) })

// The bar's schedule, one week at a time in planning or locked state.
// Managers (canEdit) add, drag and delete shifts in weeks being planned, and
// lock a week when it is ready. Employees only see it; the backend gives them
// the locked version of each week.
const SchedulePage = ({ canEdit }) => {
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [dayOrders, setDayOrders] = useState({})
  // Week statuses keyed by Monday ('yyyy-MM-dd').
  const [weeks, setWeeks] = useState({})
  const [weekBusy, setWeekBusy] = useState(false)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  // Where the new shift form was opened: { day, startMinutes }, or null.
  const [newShiftAt, setNewShiftAt] = useState(null)
  const [actionError, setActionError] = useState(null)
  const today = new Date()

  useEffect(() => {
    shiftService.getEmployees().then(setEmployees)
  }, [])

  const { from, to } = visibleRange(view, currentDate)
  const fromTime = from.getTime()
  const toTime = to.getTime()

  // Everything that a lock (by anyone) can change.
  const loadSchedule = useCallback(() => {
    const rangeFrom = new Date(fromTime)
    const rangeTo = new Date(toTime)
    return Promise.all([
      shiftService.getShifts(rangeFrom, rangeTo).then((data) => setShifts(data.map(toShift))),
      shiftService.getWeeks(dayKey(rangeFrom), dayKey(rangeTo)).then(setWeeks),
      shiftService.getDayOrders().then(setDayOrders)
    ])
  }, [fromTime, toTime])

  useEffect(() => {
    loadSchedule()
  }, [loadSchedule])

  const weekKey = dayKey(weekStart(currentDate))
  const week = weeks[weekKey]
  // Only weeks being planned can be changed; nothing while the status loads.
  const weekEditable = canEdit && week?.status === 'planning'
  const lockedWeeks = useMemo(
    () => new Set(Object.keys(weeks).filter((key) => weeks[key].status === 'locked')),
    [weeks]
  )

  // A change was refused (e.g. another manager locked the week meanwhile):
  // show why and reload what is really saved.
  const handleSaveError = (err) => {
    setActionError(errorMessage(err, 'Could not save the change'))
    loadSchedule()
  }

  const employeesById = useMemo(
    () => Object.fromEntries(employees.map((e) => [e.id, e])),
    [employees]
  )

  const visibleShifts = shifts.filter(
    (shift) => employeesById[shift.employeeId] && !hiddenIds.has(shift.employeeId)
  )

  const toggleEmployee = (id) => {
    setHiddenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleShiftChange = (id, { start, end }) => {
    setShifts((prev) => prev.map((s) => (s.id === id ? { ...s, start, end } : s)))
    shiftService
      .updateShift(id, { start: start.toISOString(), end: end.toISOString() })
      .catch(handleSaveError)
  }

  // The same shift on one or more days, saved in one request.
  const handleCreate = async (newShifts) => {
    const created = await shiftService.createShifts(
      newShifts.map(({ employeeId, start, end }) => ({
        employeeId,
        start: start.toISOString(),
        end: end.toISOString()
      }))
    )
    // Only the ones inside the shown range belong in state.
    const shown = created.map(toShift).filter((shift) => shift.start >= from && shift.start < to)
    setShifts((prev) => [...prev, ...shown])
    setNewShiftAt(null)
  }

  const handleDelete = async (shift) => {
    const name = employeesById[shift.employeeId]?.name
    const when = `${shift.start.toDateString()} ${formatTime(shift.start)}–${formatTime(shift.end)}`
    if (!window.confirm(`Delete ${name}'s shift ${when}?`)) return
    try {
      await shiftService.deleteShift(shift.id)
      setShifts((prev) => prev.filter((s) => s.id !== shift.id))
      setActionError(null)
    } catch (err) {
      handleSaveError(err)
    }
  }

  // "Add shift": today if it's on screen, otherwise the first visible day.
  const openNewShift = () => {
    const days = weekDays(currentDate)
    setNewShiftAt({ day: days.find((d) => isSameDay(d, today)) ?? days[0], startMinutes: 0 })
  }

  const handleOrderChange = (day, order) => {
    const key = dayKey(day)
    setDayOrders((prev) => ({ ...prev, [key]: order }))
    shiftService.saveDayOrder(key, order).catch(handleSaveError)
  }

  const changeWeek = async (change) => {
    setWeekBusy(true)
    try {
      const saved = await change(weekKey)
      setWeeks((prev) => ({ ...prev, [weekKey]: saved }))
      setNewShiftAt(null)
      setActionError(null)
    } catch (err) {
      handleSaveError(err)
    }
    setWeekBusy(false)
  }

  const showWeekOf = (day) => {
    setCurrentDate(day)
    setView('week')
  }

  return (
    <section>
      <CalendarToolbar
        label={formatRangeLabel(view, currentDate)}
        view={view}
        onViewChange={setView}
        onPrev={() => setCurrentDate((d) => shiftDate(view, d, -1))}
        onNext={() => setCurrentDate((d) => shiftDate(view, d, 1))}
        onToday={() => setCurrentDate(new Date())}
      />
      <EmployeeLegend employees={employees} hiddenIds={hiddenIds} onToggle={toggleEmployee} />
      {!canEdit && <p className="page-note">View only: ask a manager to change shifts.</p>}
      {view === 'week' && (
        <WeekStatusBar
          week={week}
          canEdit={canEdit}
          busy={weekBusy}
          onLock={() => changeWeek(shiftService.lockWeek)}
          onUnlock={() => changeWeek(shiftService.unlockWeek)}
          onAddShift={newShiftAt ? undefined : openNewShift}
        />
      )}
      {weekEditable && newShiftAt && (
        <NewShiftForm
          // A new click starts a fresh form.
          key={`${dayKey(newShiftAt.day)}-${newShiftAt.startMinutes}`}
          employees={employees}
          day={newShiftAt.day}
          startMinutes={newShiftAt.startMinutes}
          onSave={handleCreate}
          onCancel={() => setNewShiftAt(null)}
        />
      )}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      {view === 'week' ? (
        <WeekView
          days={weekDays(currentDate)}
          shifts={visibleShifts}
          employeesById={employeesById}
          today={today}
          dayOrders={dayOrders}
          onShiftChange={weekEditable ? handleShiftChange : undefined}
          onOrderChange={weekEditable ? handleOrderChange : undefined}
          onCreateAt={weekEditable ? (day, startMinutes) => setNewShiftAt({ day, startMinutes }) : undefined}
          onDeleteShift={weekEditable ? handleDelete : undefined}
        />
      ) : (
        <MonthView
          days={monthGrid(currentDate)}
          currentDate={currentDate}
          shifts={visibleShifts}
          employeesById={employeesById}
          today={today}
          dayOrders={dayOrders}
          lockedWeeks={canEdit ? lockedWeeks : undefined}
          onSelectDay={showWeekOf}
        />
      )}
    </section>
  )
}

export default SchedulePage

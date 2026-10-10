import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CalendarToolbar from './CalendarToolbar'
import DayStrip from './DayStrip'
import EditShiftForm from './EditShiftForm'
import EmployeeLegend from './EmployeeLegend'
import MonthView from './MonthView'
import MyShiftsList from './MyShiftsList'
import NewShiftForm from './NewShiftForm'
import WeekStatusBar from './WeekStatusBar'
import WeekView from './WeekView'
import shiftService from '../services/shifts'
import useMediaQuery, { NARROW_SCREEN, TOUCH_POINTER } from '../hooks/useMediaQuery'
import {
  agendaWeeks,
  barNow,
  inBarTime,
  toApiTime,
  formatDate,
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

// Shifts are handled in the bar's timezone, wherever the user is.
const toShift = (data) => ({ ...data, start: inBarTime(data.start), end: inBarTime(data.end) })

// The bar's schedule, one week at a time in planning or locked state.
// Managers (canEdit) add, drag and delete shifts in weeks being planned, and
// lock a week when it is ready. Employees only see it; the backend gives them
// the locked version of each week.
// On phones the week view shows one day at a time, and on touch screens
// shifts are tapped to edit instead of dragged. Anyone on the schedule
// (employeeId) also has "My shifts", the default for employees on phones.
const SchedulePage = ({ canEdit, employeeId }) => {
  const { t } = useTranslation()
  const isNarrow = useMediaQuery(NARROW_SCREEN)
  const isTouch = useMediaQuery(TOUCH_POINTER)
  const views = employeeId ? ['mine', 'week', 'month'] : ['week', 'month']
  const [view, setView] = useState(() => (employeeId && !canEdit && isNarrow ? 'mine' : 'week'))
  const [currentDate, setCurrentDate] = useState(barNow)
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [dayOrders, setDayOrders] = useState({})
  // Week statuses keyed by Monday ('yyyy-MM-dd').
  const [weeks, setWeeks] = useState({})
  const [weekBusy, setWeekBusy] = useState(false)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  // Where the new shift form was opened: { day, startMinutes }, or null.
  const [newShiftAt, setNewShiftAt] = useState(null)
  // Touch screens: the shift tapped for editing, or null.
  const [editingShift, setEditingShift] = useState(null)
  const [actionError, setActionError] = useState(null)
  const today = barNow()

  useEffect(() => {
    shiftService.getEmployees().then(setEmployees)
  }, [])

  const { from, to } = visibleRange(view, currentDate)
  const fromTime = from.getTime()
  const toTime = to.getTime()

  // Everything that a lock (by anyone) can change.
  const loadSchedule = useCallback(() => {
    const rangeFrom = inBarTime(fromTime)
    const rangeTo = inBarTime(toTime)
    const getShifts = view === 'mine' ? shiftService.getMyShifts : shiftService.getShifts
    return Promise.all([
      getShifts(rangeFrom, rangeTo).then((data) => setShifts(data.map(toShift))),
      shiftService.getWeeks(dayKey(rangeFrom), dayKey(rangeTo)).then(setWeeks),
      shiftService.getDayOrders().then(setDayOrders)
    ])
  }, [fromTime, toTime, view])

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
    setActionError(errorMessage(err, t('schedule.saveFailed')))
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
      .updateShift(id, { start: toApiTime(start), end: toApiTime(end) })
      .catch(handleSaveError)
  }

  // The same shift on one or more days, saved in one request.
  const handleCreate = async (newShifts) => {
    const created = await shiftService.createShifts(
      newShifts.map(({ employeeId, start, end }) => ({
        employeeId,
        start: toApiTime(start),
        end: toApiTime(end)
      }))
    )
    // Only the ones inside the shown range belong in state.
    const shown = created.map(toShift).filter((shift) => shift.start >= from && shift.start < to)
    setShifts((prev) => [...prev, ...shown])
    setNewShiftAt(null)
  }

  const handleDelete = async (shift) => {
    const name = employeesById[shift.employeeId]?.name
    const when = `${formatDate(shift.start, 'EEEE d.M.')} ${formatTime(shift.start)}–${formatTime(shift.end)}`
    if (!window.confirm(t('schedule.deleteConfirm', { name, when }))) return
    try {
      await shiftService.deleteShift(shift.id)
      setShifts((prev) => prev.filter((s) => s.id !== shift.id))
      setActionError(null)
    } catch (err) {
      handleSaveError(err)
    }
  }

  // Only one of the new and edit forms is open at a time.
  const openNewShiftAt = (day, startMinutes) => {
    setEditingShift(null)
    setNewShiftAt({ day, startMinutes })
  }

  const openEdit = (shift) => {
    setNewShiftAt(null)
    setEditingShift(shift)
  }

  // Saves the changes from the touch edit form.
  const handleEditSave = async (changes) => {
    const saved = toShift(await shiftService.updateShift(editingShift.id, {
      employeeId: changes.employeeId,
      start: toApiTime(changes.start),
      end: toApiTime(changes.end)
    }))
    setShifts((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
    setEditingShift(null)
  }

  const handleEditDelete = async () => {
    if (!window.confirm(t('schedule.deleteThisConfirm'))) return
    await shiftService.deleteShift(editingShift.id)
    setShifts((prev) => prev.filter((s) => s.id !== editingShift.id))
    setEditingShift(null)
  }

  // The week view's days: the whole week, or on phones only the chosen day.
  const weekViewDays = isNarrow
    ? weekDays(currentDate).filter((day) => isSameDay(day, currentDate))
    : weekDays(currentDate)

  // "Add shift": today if it's on screen, otherwise the first shown day.
  const openNewShift = () =>
    openNewShiftAt(weekViewDays.find((d) => isSameDay(d, today)) ?? weekViewDays[0], 0)

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
      setEditingShift(null)
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
        views={views}
        onViewChange={setView}
        onPrev={() => setCurrentDate((d) => shiftDate(view, d, -1))}
        onNext={() => setCurrentDate((d) => shiftDate(view, d, 1))}
        onToday={() => setCurrentDate(barNow())}
      />
      {view !== 'mine' && (
        <EmployeeLegend employees={employees} hiddenIds={hiddenIds} onToggle={toggleEmployee} />
      )}
      {!canEdit && view !== 'mine' && <p className="page-note">{t('schedule.viewOnly')}</p>}
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
      {weekEditable && editingShift && (
        <EditShiftForm
          key={editingShift.id}
          shift={editingShift}
          employees={employees}
          onSave={handleEditSave}
          onDelete={handleEditDelete}
          onCancel={() => setEditingShift(null)}
        />
      )}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      {view === 'week' && isNarrow && (
        <DayStrip days={weekDays(currentDate)} selected={currentDate} today={today} onSelect={setCurrentDate} />
      )}
      {view === 'mine' && (
        <MyShiftsList
          weekStarts={agendaWeeks(currentDate)}
          weeks={weeks}
          shifts={shifts}
          employee={employeesById[employeeId]}
          today={today}
          canEdit={canEdit}
        />
      )}
      {view === 'week' && (
        <WeekView
          days={weekViewDays}
          shifts={visibleShifts}
          employeesById={employeesById}
          today={today}
          dayOrders={dayOrders}
          // Dragging only with a mouse; on touch screens shifts are tapped.
          onShiftChange={weekEditable && !isTouch ? handleShiftChange : undefined}
          onOrderChange={weekEditable && !isTouch ? handleOrderChange : undefined}
          onDeleteShift={weekEditable && !isTouch ? handleDelete : undefined}
          onSelectShift={weekEditable && isTouch ? openEdit : undefined}
          onCreateAt={weekEditable ? openNewShiftAt : undefined}
        />
      )}
      {view === 'month' && (
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

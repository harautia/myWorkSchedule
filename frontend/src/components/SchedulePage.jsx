import { useEffect, useMemo, useState } from 'react'
import CalendarToolbar from './CalendarToolbar'
import EmployeeLegend from './EmployeeLegend'
import MonthView from './MonthView'
import NewShiftForm from './NewShiftForm'
import WeekView from './WeekView'
import shiftService from '../services/shifts'
import {
  formatRangeLabel,
  formatTime,
  isSameDay,
  monthGrid,
  shiftDate,
  visibleRange,
  weekDays
} from '../utils/dates'
import { dayKey } from '../utils/lanes'
import { errorMessage } from '../utils/forms'

const toShift = (data) => ({ ...data, start: new Date(data.start), end: new Date(data.end) })

// The bar's schedule. Managers (canEdit) can add, drag and delete shifts;
// employees only see it.
const SchedulePage = ({ canEdit }) => {
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [dayOrders, setDayOrders] = useState({})
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  // Where the new shift form was opened: { day, startMinutes }, or null.
  const [newShiftAt, setNewShiftAt] = useState(null)
  const [actionError, setActionError] = useState(null)
  const today = new Date()

  useEffect(() => {
    shiftService.getEmployees().then(setEmployees)
    shiftService.getDayOrders().then(setDayOrders)
  }, [])

  const { from, to } = visibleRange(view, currentDate)
  const fromTime = from.getTime()
  const toTime = to.getTime()

  useEffect(() => {
    shiftService.getShifts(new Date(fromTime), new Date(toTime)).then((data) => {
      setShifts(data.map(toShift))
    })
  }, [fromTime, toTime])

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
    shiftService.updateShift(id, { start: start.toISOString(), end: end.toISOString() })
  }

  const handleCreate = async ({ employeeId, start, end }) => {
    const created = await shiftService.createShift({
      employeeId,
      start: start.toISOString(),
      end: end.toISOString()
    })
    setShifts((prev) => [...prev, toShift(created)])
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
      setActionError(errorMessage(err, 'Could not delete the shift'))
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
    shiftService.saveDayOrder(key, order)
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
      {canEdit && !newShiftAt && (
        <div className="page-heading">
          <p className="page-note">Click an empty spot in the week view to add a shift there.</p>
          <button type="button" className="btn btn-nav" onClick={openNewShift}>
            Add shift
          </button>
        </div>
      )}
      {newShiftAt && (
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
          onShiftChange={canEdit ? handleShiftChange : undefined}
          onOrderChange={canEdit ? handleOrderChange : undefined}
          onCreateAt={canEdit ? (day, startMinutes) => setNewShiftAt({ day, startMinutes }) : undefined}
          onDeleteShift={canEdit ? handleDelete : undefined}
        />
      ) : (
        <MonthView
          days={monthGrid(currentDate)}
          currentDate={currentDate}
          shifts={visibleShifts}
          employeesById={employeesById}
          today={today}
          dayOrders={dayOrders}
          onSelectDay={showWeekOf}
        />
      )}
    </section>
  )
}

export default SchedulePage

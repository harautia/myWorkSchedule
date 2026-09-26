import { useEffect, useMemo, useState } from 'react'
import CalendarToolbar from './CalendarToolbar'
import EmployeeLegend from './EmployeeLegend'
import MonthView from './MonthView'
import WeekView from './WeekView'
import shiftService from '../services/shifts'
import {
  formatRangeLabel,
  monthGrid,
  shiftDate,
  visibleRange,
  weekDays
} from '../utils/dates'
import { dayKey } from '../utils/lanes'

// The bar's schedule. With canEdit false (employees) shifts can't be dragged.
const SchedulePage = ({ canEdit }) => {
  const [view, setView] = useState('week')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [employees, setEmployees] = useState([])
  const [shifts, setShifts] = useState([])
  const [dayOrders, setDayOrders] = useState({})
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
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
      setShifts(data.map((s) => ({ ...s, start: new Date(s.start), end: new Date(s.end) })))
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

      {view === 'week' ? (
        <WeekView
          days={weekDays(currentDate)}
          shifts={visibleShifts}
          employeesById={employeesById}
          today={today}
          dayOrders={dayOrders}
          onShiftChange={canEdit ? handleShiftChange : undefined}
          onOrderChange={canEdit ? handleOrderChange : undefined}
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

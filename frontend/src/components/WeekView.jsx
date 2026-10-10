import ShiftBlock from './ShiftBlock'
import useShiftDrag from '../hooks/useShiftDrag'
import {
  formatDayHeader,
  hoursFromOpening,
  isSameDay,
  openingHourLabels,
  openMinutes,
  SNAP_MINUTES
} from '../utils/dates'
import { dayKey, employeeOrder, layoutLanes, shiftsOnDay } from '../utils/lanes'

const HOUR_HEIGHT = 40

const WeekView = ({
  days,
  shifts,
  employeesById,
  today,
  dayOrders = {},
  onShiftChange,
  onOrderChange,
  onCreateAt,
  onDeleteShift,
  onSelectShift
}) => {
  const orderForDay = (day, list = shifts) =>
    employeeOrder(shiftsOnDay(list, day), dayOrders[dayKey(day)])

  const { draggingId, startDrag, withPreview, previewOrder } = useShiftDrag({
    days,
    hourHeight: HOUR_HEIGHT,
    orderForDay,
    onShiftChange,
    onOrderChange
  })
  const displayedShifts = withPreview(shifts)

  // A click on an empty spot of a day: the start of the clicked 15 min slot,
  // in minutes from opening. Clicks on shifts (also the end of a drag) are ignored.
  const handleColumnClick = (event, day) => {
    if (event.target.closest('.shift-block')) return
    const rect = event.currentTarget.getBoundingClientRect()
    const minutes = Math.floor(((event.clientY - rect.top) / HOUR_HEIGHT) * 60 / SNAP_MINUTES) * SNAP_MINUTES
    onCreateAt(day, Math.min(Math.max(minutes, 0), openMinutes() - SNAP_MINUTES))
  }

  return (
    <div className="week-scroll">
      <div className="week-grid" style={{ '--hour-height': `${HOUR_HEIGHT}px`, '--days': days.length }}>
        <div className="week-corner" />
        {days.map((day) => (
          <div
            key={day.toISOString()}
            className={`week-day-header${isSameDay(day, today) ? ' is-today' : ''}`}
          >
            {formatDayHeader(day)}
          </div>
        ))}

        <div className="week-gutter">
          {/* One row per hour from the bar's opening time */}
          {openingHourLabels().map((label, i) => (
            <div key={i} className="week-hour-label">
              {label}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayShifts = shiftsOnDay(displayedShifts, day)
          const order = previewOrder(day) ?? orderForDay(day, displayedShifts)
          return (
            <div
              key={day.toISOString()}
              className={`week-column${isSameDay(day, today) ? ' is-today' : ''}${onCreateAt ? ' is-creatable' : ''}`}
              data-testid="week-column"
              onClick={onCreateAt && ((event) => handleColumnClick(event, day))}
            >
              {layoutLanes(dayShifts, order).map(({ shift, lane, lanes }) => {
                const top = hoursFromOpening(day, shift.start)
                const bottom = hoursFromOpening(day, shift.end)
                return (
                  <ShiftBlock
                    key={shift.id}
                    shift={shift}
                    employee={employeesById[shift.employeeId]}
                    dragging={shift.id === draggingId}
                    onDragStart={onShiftChange && startDrag}
                    onDelete={onDeleteShift}
                    onSelect={onSelectShift}
                    style={{
                      top: top * HOUR_HEIGHT,
                      height: (bottom - top) * HOUR_HEIGHT,
                      left: `${(lane / lanes) * 100}%`,
                      width: `${100 / lanes}%`
                    }}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default WeekView

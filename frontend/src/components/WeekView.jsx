import ShiftBlock from './ShiftBlock'
import useShiftDrag from '../hooks/useShiftDrag'
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  formatDayHeader,
  hoursFromOpening,
  isSameDay
} from '../utils/dates'
import { dayKey, employeeOrder, layoutLanes, shiftsOnDay } from '../utils/lanes'

const HOUR_HEIGHT = 40
const HOURS = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => (DAY_START_HOUR + i) % 24
)

const WeekView = ({
  days,
  shifts,
  employeesById,
  today,
  dayOrders = {},
  onShiftChange,
  onOrderChange
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

  return (
    <div className="week-scroll">
      <div className="week-grid" style={{ '--hour-height': `${HOUR_HEIGHT}px` }}>
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
          {HOURS.map((hour) => (
            <div key={hour} className="week-hour-label">
              {String(hour).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {days.map((day) => {
          const dayShifts = shiftsOnDay(displayedShifts, day)
          const order = previewOrder(day) ?? orderForDay(day, displayedShifts)
          return (
            <div
              key={day.toISOString()}
              className={`week-column${isSameDay(day, today) ? ' is-today' : ''}`}
              data-testid="week-column"
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

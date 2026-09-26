import { formatShortTime, formatTime } from '../utils/dates'

const ShiftBlock = ({ shift, employee, style, dragging, onDragStart }) => {
  const time = `${formatTime(shift.start)}–${formatTime(shift.end)}`
  return (
    <div
      className={`shift-block${onDragStart ? ' is-draggable' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{ ...style, '--shift-color': employee.color }}
      title={`${employee.name} (${employee.role}) ${time}`}
      onPointerDown={onDragStart && ((e) => onDragStart(e, shift, 'move'))}
    >
      <strong>{employee.name}</strong>
      <span className="shift-meta">{formatShortTime(shift.start)}–{formatShortTime(shift.end)}</span>
      {onDragStart && (
        <div
          className="shift-resize"
          aria-hidden="true"
          onPointerDown={(e) => onDragStart(e, shift, 'resize')}
        />
      )}
    </div>
  )
}

export default ShiftBlock

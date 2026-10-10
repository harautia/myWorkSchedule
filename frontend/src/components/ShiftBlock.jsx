import { useTranslation } from 'react-i18next'
import { roleLabel } from '../i18n/labels'
import { formatShortTime, formatTime } from '../utils/dates'

// onSelect (touch screens): tapping the shift opens it for editing.
const ShiftBlock = ({ shift, employee, style, dragging, onDragStart, onDelete, onSelect }) => {
  const { t } = useTranslation()
  const time = `${formatTime(shift.start)}–${formatTime(shift.end)}`
  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSelect(shift)
  }
  return (
    <div
      className={`shift-block${onDragStart ? ' is-draggable' : ''}${dragging ? ' is-dragging' : ''}${onSelect ? ' is-selectable' : ''}`}
      style={{ ...style, '--shift-color': employee.color }}
      title={t('shift.title', { name: employee.name, role: roleLabel(t, employee.role), time })}
      onPointerDown={onDragStart && ((e) => onDragStart(e, shift, 'move'))}
      onClick={onSelect && (() => onSelect(shift))}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      aria-label={onSelect ? t('shift.edit', { name: employee.name, time }) : undefined}
      onKeyDown={onSelect && handleKeyDown}
    >
      <strong>{employee.name}</strong>
      <span className="shift-meta">{formatShortTime(shift.start)}–{formatShortTime(shift.end)}</span>
      {onDelete && (
        <button
          type="button"
          className="shift-delete"
          aria-label={t('shift.delete', { name: employee.name, time })}
          title={t('shift.deleteTitle')}
          // Don't start dragging the shift.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDelete(shift)}
        >
          ×
        </button>
      )}
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

import { useState } from 'react'
import { adjustShift, barDay, isSameDay, snapMinutes } from '../utils/dates'
import { insertAt } from '../utils/lanes'

// Index of the day column under x, or null when layout isn't measurable (tests).
const columnAt = (rects, x) => {
  if (!rects.length || !rects[0].width) return null
  const index = rects.findIndex((rect) => x < rect.right)
  return index === -1 ? rects.length - 1 : index
}

const sameOrder = (a, b) => a.length === b.length && a.every((id, i) => id === b[i])

// Mouse/touch dragging of shift blocks in the week view.
//  - 'move': vertical = time, the column under the pointer = day, and the
//    horizontal position inside that column = the employee's place in the day.
//  - 'resize': vertical = end time.
// While dragging, the preview is shown; changes are reported on release.
const useShiftDrag = ({ days, hourHeight, orderForDay, onShiftChange, onOrderChange }) => {
  const [preview, setPreview] = useState(null)

  const startDrag = (event, shift, mode) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()

    const grid = event.currentTarget.closest('.week-grid')
    const columns = grid
      ? [...grid.querySelectorAll('.week-column')].map((c) => c.getBoundingClientRect())
      : []
    const originIndex = days.findIndex((d) => isSameDay(d, barDay(shift.start)))
    const originOrder = orderForDay(days[originIndex])
    const originY = event.clientY
    let latest = null

    const onMove = (e) => {
      const minutesDelta = snapMinutes(((e.clientY - originY) / hourHeight) * 60)
      if (mode === 'resize') {
        latest = { ...adjustShift(shift, { mode, minutesDelta, days }), day: days[originIndex], order: originOrder }
      } else {
        const index = columnAt(columns, e.clientX) ?? originIndex
        const rect = columns[index]
        const others = orderForDay(days[index]).filter((id) => id !== shift.employeeId)
        const lane = rect?.width
          ? Math.floor(((e.clientX - rect.left) / rect.width) * (others.length + 1))
          : originOrder.indexOf(shift.employeeId)
        latest = {
          ...adjustShift(shift, { mode, dayDelta: index - originIndex, minutesDelta, days }),
          day: days[index],
          order: insertAt(others, shift.employeeId, lane)
        }
      }
      setPreview({ id: shift.id, ...latest })
    }

    const finish = (commit) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      setPreview(null)
      if (!commit || !latest) return
      if (latest.start - shift.start || latest.end - shift.end) {
        onShiftChange(shift.id, { start: latest.start, end: latest.end })
      }
      if (onOrderChange && !sameOrder(latest.order, orderForDay(latest.day))) {
        onOrderChange(latest.day, latest.order)
      }
    }
    const onUp = () => finish(true)
    const onCancel = () => finish(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  const withPreview = (shifts) =>
    preview
      ? shifts.map((s) => (s.id === preview.id ? { ...s, start: preview.start, end: preview.end } : s))
      : shifts

  // The order being previewed for this day, if the dragged shift is over it.
  const previewOrder = (day) => (preview && isSameDay(preview.day, day) ? preview.order : null)

  return { draggingId: preview?.id, startDrag, withPreview, previewOrder }
}

export default useShiftDrag

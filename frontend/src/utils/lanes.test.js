import { describe, expect, test } from 'vitest'
import { employeeOrder, insertAt, layoutLanes } from './lanes'

const at = (hour) => new Date(2026, 8, 24, hour)
const shift = (id, employeeId, start, end) => ({ id, employeeId, start: at(start), end: at(end) })

describe('employeeOrder', () => {
  const dayShifts = [shift(1, 3, 10, 16), shift(2, 1, 17, 20), shift(3, 2, 12, 18)]

  test('defaults to employee order, not start time', () => {
    expect(employeeOrder(dayShifts)).toEqual([1, 2, 3])
  })

  test('follows the saved order for the day, unknown employees last', () => {
    expect(employeeOrder(dayShifts, [3, 1])).toEqual([3, 1, 2])
  })

  test('ignores saved employees who are not working that day', () => {
    expect(employeeOrder(dayShifts, [7, 2])).toEqual([2, 1, 3])
  })
})

describe('layoutLanes', () => {
  test('an employee with two shifts that day keeps one lane', () => {
    const dayShifts = [shift(1, 2, 10, 12), shift(2, 5, 11, 18), shift(3, 2, 20, 23)]
    const result = layoutLanes(dayShifts, [5, 2])
    expect(result.map(({ shift, lane, lanes }) => [shift.id, lane, lanes]))
      .toEqual([[1, 1, 2], [2, 0, 2], [3, 1, 2]])
  })
})

describe('insertAt', () => {
  test('moves an employee to a new position', () => {
    expect(insertAt([1, 2, 3, 4], 1, 2)).toEqual([2, 3, 1, 4])
    expect(insertAt([1, 2, 3, 4], 4, 0)).toEqual([4, 1, 2, 3])
  })

  test('adds an employee who was not in the order, clamping the position', () => {
    expect(insertAt([1, 2], 5, 9)).toEqual([1, 2, 5])
  })
})

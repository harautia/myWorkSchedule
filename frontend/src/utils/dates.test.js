import { describe, expect, test } from 'vitest'
import {
  adjustShift,
  barDay,
  hoursFromOpening,
  monthGrid,
  snapMinutes,
  timeOnBarDay,
  weekDays
} from './dates'

const at = (day, hour) => new Date(2026, 8, day, hour)

describe('weekDays', () => {
  test('starts on Monday', () => {
    const days = weekDays(new Date(2026, 8, 24)) // Thursday
    expect(days).toHaveLength(7)
    expect(days[0]).toEqual(new Date(2026, 8, 21))
    expect(days[6]).toEqual(new Date(2026, 8, 27))
  })
})

describe('monthGrid', () => {
  test('covers 6 weeks from the Monday on/before the 1st', () => {
    const days = monthGrid(new Date(2026, 8, 15)) // Sept 1st 2026 is a Tuesday
    expect(days).toHaveLength(42)
    expect(days[0]).toEqual(new Date(2026, 7, 31))
  })
})

describe('barDay', () => {
  test('shift after midnight belongs to the previous evening', () => {
    expect(barDay(at(25, 1))).toEqual(new Date(2026, 8, 24))
    expect(barDay(at(25, 18))).toEqual(new Date(2026, 8, 25))
  })
})

describe('hoursFromOpening', () => {
  const day = new Date(2026, 8, 24)
  test('measures from 10:00 and continues past midnight', () => {
    expect(hoursFromOpening(day, at(24, 16))).toBe(6)
    expect(hoursFromOpening(day, at(25, 2))).toBe(16)
  })
  test('clamps to opening hours', () => {
    expect(hoursFromOpening(day, at(24, 8))).toBe(0)
    expect(hoursFromOpening(day, at(25, 6))).toBe(18)
  })
})

describe('snapMinutes', () => {
  test('rounds to 15 minutes', () => {
    expect(snapMinutes(7)).toBe(0)
    expect(snapMinutes(8)).toBe(15)
    expect(snapMinutes(-50)).toBe(-45)
  })
})

describe('adjustShift', () => {
  const days = weekDays(new Date(2026, 8, 24)) // Mon 21.9. – Sun 27.9.
  const shift = { start: at(23, 16), end: at(24, 0) } // Wed 16–00

  test('moves by minutes and days keeping the length', () => {
    const result = adjustShift(shift, { mode: 'move', dayDelta: 1, minutesDelta: 90, days })
    expect(result).toEqual({ start: new Date(2026, 8, 24, 17, 30), end: new Date(2026, 8, 25, 1, 30) })
  })

  test('keeps a moved shift inside opening hours and the week', () => {
    const late = adjustShift(shift, { mode: 'move', dayDelta: 10, minutesDelta: 600, days })
    expect(late).toEqual({ start: at(27, 20), end: at(28, 4) })
    const early = adjustShift(shift, { mode: 'move', dayDelta: 0, minutesDelta: -600, days })
    expect(early).toEqual({ start: at(23, 10), end: at(23, 18) })
  })

  test('resize changes only the end, with a 30 min minimum and closing time maximum', () => {
    expect(adjustShift(shift, { mode: 'resize', minutesDelta: 120, days }))
      .toEqual({ start: shift.start, end: at(24, 2) })
    expect(adjustShift(shift, { mode: 'resize', minutesDelta: -1000, days }).end)
      .toEqual(new Date(2026, 8, 23, 16, 30))
    expect(adjustShift(shift, { mode: 'resize', minutesDelta: 1000, days }).end).toEqual(at(24, 4))
  })
})

describe('timeOnBarDay', () => {
  test('evening times are on the bar day itself', () => {
    expect(timeOnBarDay(new Date(2026, 8, 25), '20:30')).toEqual(new Date(2026, 8, 25, 20, 30))
  })

  test('times after midnight are on the next calendar day', () => {
    expect(timeOnBarDay(new Date(2026, 8, 25), '02:00')).toEqual(new Date(2026, 8, 26, 2))
    expect(timeOnBarDay(new Date(2026, 8, 30), '00:15')).toEqual(new Date(2026, 9, 1, 0, 15))
  })
})

import { afterEach, describe, expect, test } from 'vitest'
import { dayKey } from './lanes'
import {
  adjustShift,
  barDay,
  barDayStart,
  formatShortTime,
  formatTime,
  fromDayKey,
  openingHourLabels,
  openMinutes,
  setBarSettings,
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

describe('bar settings', () => {
  const HELSINKI = { timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', clock24h: true }
  afterEach(() => setBarSettings(HELSINKI))

  test('times are shown in the bar\'s timezone, not the computer\'s', () => {
    // The tests run in Helsinki time; this bar is in New York.
    setBarSettings({ ...HELSINKI, timezone: 'America/New_York' })
    const start = '2026-09-25T22:00:00Z' // 18:00 in New York, 01:00 in Helsinki

    expect(formatTime(start)).toBe('18:00')
    expect(dayKey(barDay(start))).toBe('2026-09-25')
    // The same moment (toISOString of a bar time has the bar's offset: 18:00-04:00).
    expect(timeOnBarDay(fromDayKey('2026-09-25'), '18:00').getTime()).toBe(Date.parse(start))
  })

  test('the bar day follows the opening hours', () => {
    setBarSettings({ ...HELSINKI, opensAt: '16:00', closesAt: '02:30' })
    const friday = fromDayKey('2026-09-25')

    expect(openMinutes()).toBe(630)
    expect(barDayStart(friday)).toEqual(new Date(2026, 8, 25, 16))
    // 02:00 on Saturday is still Friday's bar day; 03:00 is Saturday's.
    expect(dayKey(barDay(new Date(2026, 8, 26, 2)))).toBe('2026-09-25')
    expect(dayKey(barDay(new Date(2026, 8, 26, 3)))).toBe('2026-09-26')
    expect(openingHourLabels()).toEqual(['16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00', '00:00', '01:00', '02:00'])
  })

  test('a bar that closes before midnight has no after-midnight times', () => {
    setBarSettings({ ...HELSINKI, opensAt: '08:00', closesAt: '22:00' })
    const friday = fromDayKey('2026-09-25')

    expect(timeOnBarDay(friday, '07:00')).toEqual(new Date(2026, 8, 25, 7))
    expect(dayKey(barDay(new Date(2026, 8, 25, 1)))).toBe('2026-09-25')
  })

  test('the 12-hour clock', () => {
    setBarSettings({ ...HELSINKI, clock24h: false })
    expect(formatTime(new Date(2026, 8, 25, 18, 30))).toBe('6:30 PM')
    expect(formatShortTime(new Date(2026, 8, 25, 18))).toBe('6PM')
    expect(openingHourLabels()[0]).toBe('10:00 AM')
  })

  test('the opening time is right on the day the clocks change', () => {
    // Summer time ends in Finland on Sunday 25 October 2026 at 04:00.
    expect(barDayStart(fromDayKey('2026-10-25'))).toEqual(new Date(2026, 9, 25, 10))
  })
})

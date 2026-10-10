import { canEditSchedule, pagesFor } from './access'

const user = (groups, barId = 1) => ({ groups, barId })

test('admin sees only the bars page', () => {
  expect(pagesFor(user(['adminGroup'], null))).toEqual(['bars'])
})

test('manager sees the schedule, employees and bar settings, and can edit', () => {
  const manager = user(['managerGroup'])
  expect(pagesFor(manager)).toEqual(['schedule', 'employees', 'settings'])
  expect(canEditSchedule(manager)).toBe(true)
})

test('employee sees only the schedule, read-only', () => {
  const employee = user(['employeeGroup'])
  expect(pagesFor(employee)).toEqual(['schedule'])
  expect(canEditSchedule(employee)).toBe(false)
})

test('pages from several groups are combined', () => {
  expect(pagesFor(user(['adminGroup', 'managerGroup']))).toEqual(['schedule', 'employees', 'settings', 'bars'])
})

test('without a bar there is no schedule', () => {
  expect(pagesFor(user(['employeeGroup'], null))).toEqual([])
})

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

describe('on the hosted service', () => {
  const owner = (subscriptionStatus) => ({ ...user(['managerGroup']), role: 'owner', subscriptionStatus })

  test('the owner also gets the billing page', () => {
    expect(pagesFor(owner('trialing'))).toEqual(['schedule', 'employees', 'settings', 'billing'])
    // Other managers don't; nor does anyone without a subscription (self-hosted).
    expect(pagesFor({ ...owner('active'), role: 'manager' })).toEqual(['schedule', 'employees', 'settings'])
    expect(pagesFor(owner(null))).toEqual(['schedule', 'employees', 'settings'])
  })

  test('read-only: pages stay, nothing can be edited', () => {
    expect(pagesFor(owner('read_only'))).toEqual(['schedule', 'employees', 'settings', 'billing'])
    expect(canEditSchedule(owner('read_only'))).toBe(false)
    expect(canEditSchedule(owner('past_due'))).toBe(true)
  })

  test('locked or unfinished: only billing, for the owner', () => {
    expect(pagesFor(owner('locked'))).toEqual(['billing'])
    expect(pagesFor(owner('incomplete'))).toEqual(['billing'])
    expect(pagesFor({ ...user(['employeeGroup']), role: 'employee', subscriptionStatus: 'locked' })).toEqual([])
  })
})

test('an admin in support mode sees the bar read-only, without settings', () => {
  const support = { ...user(['adminGroup', 'managerGroup']), supportMode: true }
  expect(pagesFor(support)).toEqual(['schedule', 'employees', 'bars'])
  expect(canEditSchedule(support)).toBe(false)
})

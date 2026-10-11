export const ADMIN = 'adminGroup'
export const MANAGER = 'managerGroup'
export const EMPLOYEE = 'employeeGroup'

const inGroup = (user, ...groups) => groups.some((group) => user.groups.includes(group))

// What the bar's subscription on the hosted service allows (spec BILL-06):
// 'full', 'read_only' or 'billing_only'. Bars without a subscription status
// (self-hosted, or created by the platform admin) have full access. The
// backend enforces the same.
export const subscriptionAccess = (user) => {
  const status = user.subscriptionStatus
  if (status === 'read_only') return 'read_only'
  if (status === 'incomplete' || status === 'locked' || status === 'canceled') return 'billing_only'
  return 'full'
}

// Only managers change the schedule, and only when the subscription allows
// it; employees, and admins in support mode, see it read-only.
export const canEditSchedule = (user) =>
  Boolean(user.barId) && inGroup(user, MANAGER) && !user.supportMode && subscriptionAccess(user) === 'full'

// The account owner manages billing on the hosted service.
export const managesBilling = (user) => user.role === 'owner' && Boolean(user.subscriptionStatus) && !user.supportMode

// Pages the user may open, in nav order. The backend enforces the same rules;
// this only decides what is shown.
export const pagesFor = (user) => {
  const pages = []
  const barAccess = user.barId ? subscriptionAccess(user) : null
  if (barAccess && barAccess !== 'billing_only') {
    if (inGroup(user, MANAGER, EMPLOYEE)) pages.push('schedule')
    if (inGroup(user, MANAGER)) pages.push('employees')
    if (inGroup(user, MANAGER) && !user.supportMode) pages.push('settings')
  }
  if (managesBilling(user)) pages.push('billing')
  if (inGroup(user, ADMIN)) pages.push('bars')
  return pages
}

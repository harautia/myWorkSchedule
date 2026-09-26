export const ADMIN = 'adminGroup'
export const MANAGER = 'managerGroup'
export const EMPLOYEE = 'employeeGroup'

export const GROUP_LABELS = {
  [ADMIN]: 'Admin',
  [MANAGER]: 'Manager',
  [EMPLOYEE]: 'Employee'
}

const inGroup = (user, ...groups) => groups.some((group) => user.groups.includes(group))

// Only managers change the schedule; employees see it read-only.
export const canEditSchedule = (user) => Boolean(user.barId) && inGroup(user, MANAGER)

// Pages the user may open, in nav order. The backend enforces the same rules;
// this only decides what is shown.
export const pagesFor = (user) => {
  const pages = []
  if (user.barId && inGroup(user, MANAGER, EMPLOYEE)) pages.push('schedule')
  if (user.barId && inGroup(user, MANAGER)) pages.push('employees')
  if (inGroup(user, ADMIN)) pages.push('bars')
  return pages
}

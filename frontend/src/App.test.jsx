import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import i18n from './i18n'
import { setBarSettings } from './utils/dates'
import authService from './services/auth'
import adminService from './services/admin'
import accountLinkService from './services/accountLinks'
import appInfoService from './services/appInfo'
import barService from './services/bar'
import employeeService from './services/employees'
import shiftService from './services/shifts'

vi.mock('./services/auth')
vi.mock('./services/admin')
vi.mock('./services/accountLinks')
vi.mock('./services/appInfo')
vi.mock('./services/bar')
vi.mock('./services/employees')
vi.mock('./services/shifts')

const users = {
  admin: { id: 1, username: 'admin', name: 'Service Admin', groups: ['adminGroup'], barId: null, barName: null },
  anna: { id: 2, username: 'anna', name: 'Anna', groups: ['managerGroup'], barId: 1, barName: 'Imaginary Bar' },
  mikko: { id: 3, username: 'mikko', name: 'Mikko', groups: ['employeeGroup'], barId: 1, barName: 'Imaginary Bar' }
}

beforeEach(() => {
  vi.resetAllMocks()
  i18n.changeLanguage('en')
  setBarSettings({ timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', clock24h: true, locale: 'en' })
  barService.getBar.mockResolvedValue({
    id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', locale: 'en', clock24h: true, accentColor: '#863bff'
  })
  barService.getOnboarding.mockResolvedValue({ invite: true, plan: true, lock: true, dismissed: true })
  appInfoService.getAppInfo.mockResolvedValue({ version: '0.1.0', sourceUrl: 'https://example.org/src' })
  shiftService.getEmployees.mockResolvedValue([])
  shiftService.getShifts.mockResolvedValue([])
  shiftService.getDayOrders.mockResolvedValue({})
  shiftService.getWeeks.mockResolvedValue({})
  adminService.getBars.mockResolvedValue([
    { id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', employeeCount: 7, userCount: 3, createdAt: '2026-09-26T00:00:00Z' },
    { id: 2, name: 'Harbour Pub', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', employeeCount: 3, userCount: 2, createdAt: '2026-09-26T00:00:00Z' }
  ])
  employeeService.getDetails.mockResolvedValue([
    { id: 1, name: 'Anna', role: 'manager', color: '#863bff', account: { username: 'anna', groups: ['managerGroup'] } },
    { id: 4, name: 'Jukka', role: 'waiter', color: '#e8590c', account: null }
  ])
})

test('shows the login page without a session and logs in', async () => {
  authService.getCurrentUser.mockResolvedValue(null)
  authService.login.mockResolvedValue(users.mikko)
  render(<App />)

  await userEvent.type(await screen.findByLabelText('Email or username'), 'mikko')
  await userEvent.type(screen.getByLabelText('Password'), 'secret')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(authService.login).toHaveBeenCalledWith('mikko', 'secret')
  expect(await screen.findByText('Imaginary Bar Work Schedule')).toBeInTheDocument()
})

test('shows the error from a failed login', async () => {
  authService.getCurrentUser.mockResolvedValue(null)
  authService.login.mockRejectedValue({ response: { data: { error: 'invalid username or password' } } })
  render(<App />)

  await userEvent.type(await screen.findByLabelText('Email or username'), 'mikko')
  await userEvent.type(screen.getByLabelText('Password'), 'wrong')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('invalid username or password')
})

test('admin sees the list of all bars and no schedule', async () => {
  authService.getCurrentUser.mockResolvedValue(users.admin)
  render(<App />)

  expect(await screen.findByText('Harbour Pub')).toBeInTheDocument()
  expect(screen.getByText('Imaginary Bar')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Schedule' })).not.toBeInTheDocument()
  expect(shiftService.getShifts).not.toHaveBeenCalled()
})

test('manager can switch between the schedule and the employees', async () => {
  authService.getCurrentUser.mockResolvedValue(users.anna)
  render(<App />)

  expect(await screen.findByRole('button', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page')
  expect(screen.queryByText(/View only/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Bars' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Employees' }))
  expect(await screen.findByText('Jukka')).toBeInTheDocument()
  expect(screen.getByText('none')).toBeInTheDocument()
})

test('employee sees only the schedule, read-only', async () => {
  authService.getCurrentUser.mockResolvedValue(users.mikko)
  render(<App />)

  expect(await screen.findByText(/View only/)).toBeInTheDocument()
  expect(screen.queryByRole('navigation', { name: 'Pages' })).not.toBeInTheDocument()
  expect(employeeService.getDetails).not.toHaveBeenCalled()
})

test('logging out returns to the login page', async () => {
  authService.getCurrentUser.mockResolvedValue(users.mikko)
  authService.logout.mockResolvedValue()
  render(<App />)

  await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))
  expect(await screen.findByLabelText('Email or username')).toBeInTheDocument()
})

test('the login page shows the version and the source code link', async () => {
  authService.getCurrentUser.mockResolvedValue(null)
  render(<App />)

  expect(await screen.findByText(/myWorkSchedule 0\.1\.0/)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://example.org/src')
})

test('the bar\'s settings are applied, and a manager can change them', async () => {
  barService.getBar.mockResolvedValue({
    id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '16:00', closesAt: '02:00', locale: 'en', clock24h: true, accentColor: '#0ca678'
  })
  barService.updateBar.mockImplementation((settings) => Promise.resolve({ id: 1, ...settings }))
  authService.getCurrentUser.mockResolvedValue(users.anna)
  const { container } = render(<App />)

  // The week view starts at the bar's opening time, in its accent colour.
  expect(await screen.findByRole('button', { name: 'Schedule' })).toBeInTheDocument()
  expect(container.querySelector('.week-hour-label')).toHaveTextContent('16:00')
  expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#0ca678')

  await userEvent.click(screen.getByRole('button', { name: 'Bar settings' }))
  const name = screen.getByLabelText('Bar name')
  await userEvent.clear(name)
  await userEvent.type(name, 'Imaginary Bar & Grill')
  await userEvent.selectOptions(screen.getByLabelText('Clock'), '12-hour (6:30 PM)')
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

  expect(barService.updateBar).toHaveBeenCalledWith(expect.objectContaining({ name: 'Imaginary Bar & Grill', clock24h: false }))
  expect(await screen.findByRole('heading', { name: 'Imaginary Bar & Grill Work Schedule' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Schedule' }))
  expect(container.querySelector('.week-hour-label')).toHaveTextContent('4:00 PM')
})

test('employees don\'t get the bar settings page', async () => {
  authService.getCurrentUser.mockResolvedValue(users.mikko)
  render(<App />)
  expect(await screen.findByText(/View only/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Bar settings' })).not.toBeInTheDocument()
})

test('a Finnish bar gets the app in Finnish, with Finnish weekday names', async () => {
  barService.getBar.mockResolvedValue({
    id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', locale: 'fi', clock24h: true, accentColor: '#863bff'
  })
  authService.getCurrentUser.mockResolvedValue(users.anna)
  const { container } = render(<App />)

  expect(await screen.findByRole('button', { name: 'Työvuorot' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Työntekijät' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Kirjaudu ulos' })).toBeInTheDocument()
  expect(container.querySelector('.week-day-header')).toHaveTextContent(/^ma /)
  expect(document.documentElement.lang).toBe('fi')
})

test('an invitation link opens the invitation page, then the app', async () => {
  window.history.replaceState(null, '', '/?invite=tok123')
  accountLinkService.getInvite.mockResolvedValue({ name: 'Mikko', email: 'mikko@example.com', barName: 'Imaginary Bar', locale: 'en' })
  accountLinkService.acceptInvite.mockResolvedValue(users.mikko)
  authService.getCurrentUser.mockResolvedValue(null)
  render(<App />)

  expect(await screen.findByText(/Hi Mikko, you've been added/)).toBeInTheDocument()
  await userEvent.type(screen.getByLabelText('New password'), 'mikko-password')
  await userEvent.type(screen.getByLabelText('Repeat the password'), 'mikko-password')
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText(/View only/)).toBeInTheDocument()
  expect(window.location.search).toBe('')
})

test('a reset link opens the password reset page', async () => {
  window.history.replaceState(null, '', '/?reset=r55')
  authService.getCurrentUser.mockResolvedValue(null)
  render(<App />)

  expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Back to login' }))
  expect(await screen.findByLabelText('Email or username')).toBeInTheDocument()
  expect(window.location.search).toBe('')
})

test('when sign-up is open, the login page leads to it, and so does /?signup', async () => {
  appInfoService.getAppInfo.mockResolvedValue({ version: '0.1.0', signupEnabled: true, turnstileSiteKey: null })
  authService.getCurrentUser.mockResolvedValue(null)
  const { unmount } = render(<App />)

  await userEvent.click(await screen.findByRole('button', { name: 'Create an account' }))
  expect(screen.getByRole('heading', { name: 'Create your bar\'s schedule' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Already have an account? Log in' }))
  expect(await screen.findByLabelText('Email or username')).toBeInTheDocument()
  unmount()

  window.history.replaceState(null, '', '/?signup')
  render(<App />)
  expect(await screen.findByRole('heading', { name: 'Create your bar\'s schedule' })).toBeInTheDocument()
  window.history.replaceState(null, '', '/')
})

test('/?signup shows the login page when sign-up is closed', async () => {
  window.history.replaceState(null, '', '/?signup')
  authService.getCurrentUser.mockResolvedValue(null)
  render(<App />)

  expect(await screen.findByLabelText('Email or username')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Create an account' })).not.toBeInTheDocument()
  window.history.replaceState(null, '', '/')
})

test('a new owner sees the verification reminder and the onboarding checklist', async () => {
  authService.getCurrentUser.mockResolvedValue({ ...users.anna, role: 'owner', email: 'anna@example.com', emailVerified: false })
  barService.getOnboarding.mockResolvedValue({ invite: false, plan: false, lock: false, dismissed: false })
  render(<App />)

  expect(await screen.findByText(/Please confirm your email address/)).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Get your bar started' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Go to Employees' }))
  expect(screen.getByRole('button', { name: 'Employees' })).toHaveAttribute('aria-current', 'page')
})

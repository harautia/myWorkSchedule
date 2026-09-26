import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import App from './App'
import authService from './services/auth'
import adminService from './services/admin'
import employeeService from './services/employees'
import shiftService from './services/shifts'

vi.mock('./services/auth')
vi.mock('./services/admin')
vi.mock('./services/employees')
vi.mock('./services/shifts')

const users = {
  admin: { id: 1, username: 'admin', name: 'Service Admin', groups: ['adminGroup'], barId: null, barName: null },
  anna: { id: 2, username: 'anna', name: 'Anna', groups: ['managerGroup'], barId: 1, barName: 'Imaginary Bar' },
  mikko: { id: 3, username: 'mikko', name: 'Mikko', groups: ['employeeGroup'], barId: 1, barName: 'Imaginary Bar' }
}

beforeEach(() => {
  vi.resetAllMocks()
  shiftService.getEmployees.mockResolvedValue([])
  shiftService.getShifts.mockResolvedValue([])
  shiftService.getDayOrders.mockResolvedValue({})
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

  await userEvent.type(await screen.findByLabelText('Username'), 'mikko')
  await userEvent.type(screen.getByLabelText('Password'), 'secret')
  await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

  expect(authService.login).toHaveBeenCalledWith('mikko', 'secret')
  expect(await screen.findByText('Imaginary Bar Work Schedule')).toBeInTheDocument()
})

test('shows the error from a failed login', async () => {
  authService.getCurrentUser.mockResolvedValue(null)
  authService.login.mockRejectedValue({ response: { data: { error: 'invalid username or password' } } })
  render(<App />)

  await userEvent.type(await screen.findByLabelText('Username'), 'mikko')
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
  expect(await screen.findByLabelText('Username')).toBeInTheDocument()
})

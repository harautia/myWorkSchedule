import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import BarsPage from './BarsPage'
import adminService from '../services/admin'

vi.mock('../services/admin')

const BARS = [
  { id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', employeeCount: 7, userCount: 3, createdAt: '2026-09-26T00:00:00Z' }
]

const details = (users) => ({
  bar: { id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00' },
  users
})
const BAR_DETAILS_BAR = { id: 1, name: 'Imaginary Bar' }
const ANNA = { id: 2, username: 'anna', name: 'Anna', groups: ['managerGroup'], employee: { id: 1, name: 'Anna', role: 'manager' } }
const MIKKO = { id: 3, username: 'mikko', name: 'Mikko', groups: ['employeeGroup'], employee: { id: 2, name: 'Mikko', role: 'waiter' } }
const KALLE = { id: 4, username: 'kalle', name: 'Kalle', groups: ['managerGroup'], employee: null }

beforeEach(() => {
  vi.resetAllMocks()
  adminService.getBars.mockResolvedValue(BARS)
  adminService.getBar.mockResolvedValue(details([ANNA, MIKKO]))
})

const openBar = async () => {
  render(<BarsPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'Imaginary Bar' }))
  return screen.findByRole('heading', { name: 'Imaginary Bar' })
}

const rowOf = (text) => screen.getByRole('cell', { name: text }).closest('tr')

test('opening a bar shows all its managers and employees', async () => {
  await openBar()

  expect(adminService.getBar).toHaveBeenCalledWith(1)
  expect(within(rowOf('anna')).getByText('Manager')).toBeInTheDocument()
  expect(within(rowOf('mikko')).getByText('Employee')).toBeInTheDocument()
  // employees are listed but can't be edited here
  expect(within(rowOf('mikko')).queryByRole('button')).not.toBeInTheDocument()
})

test('the only manager cannot be removed', async () => {
  await openBar()
  expect(within(rowOf('anna')).getByRole('button', { name: 'Remove' })).toBeDisabled()
})

test('creates a new bar with its first manager and opens it', async () => {
  adminService.createBar.mockResolvedValue(details([KALLE]))
  render(<BarsPage />)

  await userEvent.click(await screen.findByRole('button', { name: 'New bar' }))
  await userEvent.type(screen.getByLabelText('Bar name'), 'Corner Pub')
  await userEvent.type(screen.getByLabelText("Manager's name"), 'Kalle')
  await userEvent.type(screen.getByLabelText('Username'), 'kalle')
  await userEvent.type(screen.getByLabelText('Password'), 'long-enough-password')
  await userEvent.click(screen.getByRole('button', { name: 'Create bar' }))

  expect(adminService.createBar).toHaveBeenCalledWith(
    { name: 'Corner Pub', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', locale: 'en', clock24h: true, accentColor: '#863bff' },
    { name: 'Kalle', username: 'kalle', password: 'long-enough-password' }
  )
  expect(await screen.findByRole('heading', { name: 'Imaginary Bar' })).toBeInTheDocument()
})

test('shows the backend error when creating fails', async () => {
  adminService.createBar.mockRejectedValue({ response: { data: { error: 'username is already taken' } } })
  render(<BarsPage />)

  await userEvent.click(await screen.findByRole('button', { name: 'New bar' }))
  await userEvent.type(screen.getByLabelText('Bar name'), 'Corner Pub')
  await userEvent.type(screen.getByLabelText("Manager's name"), 'Anna')
  await userEvent.type(screen.getByLabelText('Username'), 'anna')
  await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
  expect(screen.getByLabelText('Password').value).toHaveLength(14)
  await userEvent.click(screen.getByRole('button', { name: 'Create bar' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('username is already taken')
})

test('saves edited bar settings', async () => {
  adminService.updateBar.mockImplementation((id, bar) => Promise.resolve({ id, ...bar }))
  await openBar()

  const name = screen.getByLabelText('Bar name')
  await userEvent.clear(name)
  await userEvent.type(name, 'Imaginary Bar & Grill')
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

  expect(adminService.updateBar).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Imaginary Bar & Grill' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Bar settings saved')
})

test('adds a manager', async () => {
  adminService.addManager.mockResolvedValue(KALLE)
  await openBar()
  adminService.getBar.mockResolvedValue(details([ANNA, KALLE, MIKKO]))

  await userEvent.click(screen.getByRole('button', { name: 'Add manager' }))
  const form = screen.getByRole('form', { name: 'Add manager' })
  await userEvent.type(within(form).getByLabelText("Manager's name"), 'Kalle')
  await userEvent.type(within(form).getByLabelText('Username'), 'kalle')
  await userEvent.type(within(form).getByLabelText('Password'), 'long-enough-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Add manager' }))

  expect(adminService.addManager).toHaveBeenCalledWith(1, { name: 'Kalle', username: 'kalle', password: 'long-enough-password' })
  expect(await screen.findByRole('cell', { name: 'kalle' })).toBeInTheDocument()
})

test('sets a new password for a manager (password recovery)', async () => {
  adminService.updateManager.mockResolvedValue(ANNA)
  await openBar()

  await userEvent.click(within(rowOf('anna')).getByRole('button', { name: 'Edit' }))
  const form = screen.getByRole('form', { name: 'Edit anna' })
  await userEvent.click(within(form).getByRole('button', { name: 'Set new password' }))
  await userEvent.type(within(form).getByLabelText('New password'), 'recovered-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(adminService.updateManager).toHaveBeenCalledWith(1, 2, { password: 'recovered-password' })
  expect(await screen.findByRole('status')).toHaveTextContent('New password set for anna')
})

test('removes a manager after confirmation', async () => {
  adminService.getBar.mockResolvedValue(details([ANNA, KALLE, MIKKO]))
  adminService.removeManager.mockResolvedValue()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  await openBar()
  adminService.getBar.mockResolvedValue(details([ANNA, MIKKO]))

  await userEvent.click(within(rowOf('kalle')).getByRole('button', { name: 'Remove' }))

  expect(confirm).toHaveBeenCalled()
  expect(adminService.removeManager).toHaveBeenCalledWith(1, 4)
  expect(await screen.findByRole('status')).toHaveTextContent('Removed manager kalle')
  expect(screen.queryByRole('cell', { name: 'kalle' })).not.toBeInTheDocument()
  confirm.mockRestore()
})

test('the bar can only be deleted after typing its name', async () => {
  adminService.deleteBar.mockResolvedValue()
  await openBar()
  adminService.getBars.mockResolvedValue([])

  const form = screen.getByRole('form', { name: 'Delete bar' })
  const button = within(form).getByRole('button', { name: 'Delete bar permanently' })
  expect(button).toBeDisabled()

  await userEvent.type(within(form).getByLabelText('Type the bar name to confirm'), 'Imaginary')
  expect(button).toBeDisabled()
  await userEvent.type(within(form).getByLabelText('Type the bar name to confirm'), ' Bar')
  await userEvent.click(button)

  expect(adminService.deleteBar).toHaveBeenCalledWith(BAR_DETAILS_BAR.id)
  expect(await screen.findByRole('status')).toHaveTextContent('Deleted Imaginary Bar')
  expect(await screen.findByText('Bars using the service (0)')).toBeInTheDocument()
})

test('the manager form says the manager goes on the schedule', async () => {
  render(<BarsPage />)
  await userEvent.click(await screen.findByRole('button', { name: 'New bar' }))
  expect(screen.getByText(/also added to the schedule with the role manager/)).toBeInTheDocument()
})

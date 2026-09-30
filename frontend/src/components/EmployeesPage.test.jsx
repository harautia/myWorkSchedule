import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import EmployeesPage from './EmployeesPage'
import employeeService from '../services/employees'

vi.mock('../services/employees')

const ANNA = { id: 1, name: 'Anna', role: 'manager', color: '#863bff', account: { username: 'anna', groups: ['managerGroup'] }, shiftCount: 4 }
const MIKKO = { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6', account: { username: 'mikko', groups: ['employeeGroup'] }, shiftCount: 3 }
const LIISA = { id: 3, name: 'Liisa', role: 'waiter', color: '#0ca678', account: null, shiftCount: 1 }
const KALLE = { id: 4, name: 'Kalle', role: 'waiter', color: '#e8590c', account: { username: 'kalle', groups: ['employeeGroup'] }, shiftCount: 0 }

beforeEach(() => {
  vi.resetAllMocks()
  employeeService.getDetails.mockResolvedValue([ANNA, MIKKO, LIISA])
})

const rowOf = async (name) => (await screen.findByRole('cell', { name })).closest('tr')

test('managers are listed but managed by the admin', async () => {
  render(<EmployeesPage />)

  const anna = await rowOf('anna')
  expect(within(anna).queryByRole('button')).not.toBeInTheDocument()
  expect(within(anna).getByText('managed by admin')).toBeInTheDocument()
  expect(within(await rowOf('mikko')).getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

test('adds an employee with a login account', async () => {
  employeeService.create.mockResolvedValue(KALLE)
  render(<EmployeesPage />)
  await screen.findByText('Employees (3)')
  employeeService.getDetails.mockResolvedValue([ANNA, MIKKO, LIISA, KALLE])

  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
  const form = screen.getByRole('form', { name: 'Add employee' })
  await userEvent.type(within(form).getByLabelText("Employee's name"), 'Kalle')
  await userEvent.type(within(form).getByLabelText('Username'), 'kalle')
  await userEvent.type(within(form).getByLabelText('Password'), 'long-enough-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Add employee' }))

  expect(employeeService.create).toHaveBeenCalledWith({ name: 'Kalle', username: 'kalle', password: 'long-enough-password' })
  expect(await screen.findByRole('status')).toHaveTextContent('Added Kalle (kalle)')
  expect(await screen.findByText('Employees (4)')).toBeInTheDocument()
})

test('shows the backend error when adding fails', async () => {
  employeeService.create.mockRejectedValue({ response: { data: { error: 'username kalle is already in use' } } })
  render(<EmployeesPage />)

  await userEvent.click(await screen.findByRole('button', { name: 'Add employee' }))
  const form = screen.getByRole('form', { name: 'Add employee' })
  await userEvent.type(within(form).getByLabelText("Employee's name"), 'Kalle')
  await userEvent.type(within(form).getByLabelText('Username'), 'kalle')
  await userEvent.click(within(form).getByRole('button', { name: 'Generate' }))
  await userEvent.click(within(form).getByRole('button', { name: 'Add employee' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('username kalle is already in use')
})

test('renames an employee and sets a new password', async () => {
  employeeService.update.mockResolvedValue(MIKKO)
  render(<EmployeesPage />)

  await userEvent.click(within(await rowOf('mikko')).getByRole('button', { name: 'Edit' }))
  const form = screen.getByRole('form', { name: 'Edit Mikko' })
  await userEvent.clear(within(form).getByLabelText('Name'))
  await userEvent.type(within(form).getByLabelText('Name'), 'Mikael')
  await userEvent.click(within(form).getByRole('button', { name: 'Set new password' }))
  await userEvent.type(within(form).getByLabelText('New password'), 'recovered-password')
  await userEvent.click(within(form).getByRole('button', { name: 'Save' }))

  expect(employeeService.update).toHaveBeenCalledWith(2, { name: 'Mikael', password: 'recovered-password' })
  expect(await screen.findByRole('status')).toHaveTextContent('New password set for mikko')
})

test('an employee without a login has no password to set', async () => {
  render(<EmployeesPage />)

  await userEvent.click(within((await screen.findByText('Liisa')).closest('tr')).getByRole('button', { name: 'Edit' }))
  const form = screen.getByRole('form', { name: 'Edit Liisa' })
  expect(within(form).queryByRole('button', { name: 'Set new password' })).not.toBeInTheDocument()
})

test('removes an employee after confirming what is deleted', async () => {
  employeeService.remove.mockResolvedValue()
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<EmployeesPage />)
  const mikko = await rowOf('mikko')
  employeeService.getDetails.mockResolvedValue([ANNA, LIISA])

  await userEvent.click(within(mikko).getByRole('button', { name: 'Remove' }))

  expect(confirm).toHaveBeenCalledWith('Remove Mikko? This deletes their login account and 3 shifts.')
  expect(employeeService.remove).toHaveBeenCalledWith(2)
  expect(await screen.findByRole('status')).toHaveTextContent('Removed Mikko')
  expect(screen.queryByRole('cell', { name: 'mikko' })).not.toBeInTheDocument()
  confirm.mockRestore()
})

test('nothing is removed when the confirmation is cancelled', async () => {
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  render(<EmployeesPage />)

  await userEvent.click(within((await screen.findByText('Liisa')).closest('tr')).getByRole('button', { name: 'Remove' }))

  expect(confirm).toHaveBeenCalledWith('Remove Liisa? This deletes 1 shift.')
  expect(employeeService.remove).not.toHaveBeenCalled()
  confirm.mockRestore()
})

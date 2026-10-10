import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import EmployeesPage from './EmployeesPage'
import employeeService from '../services/employees'

vi.mock('../services/employees')

const ANNA = { id: 1, name: 'Anna', role: 'manager', color: '#863bff', account: { username: 'anna', groups: ['managerGroup'] }, shiftCount: 4 }
const MIKKO = { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6', account: { username: 'mikko', groups: ['employeeGroup'] }, shiftCount: 3 }
const LIISA = { id: 3, name: 'Liisa', role: 'waiter', color: '#0ca678', account: null, shiftCount: 1 }
const INVITED = { id: 4, name: 'Kalle', role: 'waiter', color: '#e8590c', account: null, invite: { email: 'kalle@example.com', expiresAt: '2026-10-17T00:00:00Z' }, shiftCount: 0 }

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

test('adds an employee and emails the invitation', async () => {
  employeeService.create.mockResolvedValue({ ...INVITED, inviteSent: { email: 'kalle@example.com', sent: true } })
  render(<EmployeesPage />)
  await screen.findByText('Employees (3)')
  employeeService.getDetails.mockResolvedValue([ANNA, MIKKO, LIISA, INVITED])

  await userEvent.click(screen.getByRole('button', { name: 'Add employee' }))
  const form = screen.getByRole('form', { name: 'Add employee' })
  await userEvent.type(within(form).getByLabelText("Employee's name"), 'Kalle')
  await userEvent.type(within(form).getByLabelText('Email'), 'kalle@example.com')
  await userEvent.click(within(form).getByRole('button', { name: 'Add and invite' }))

  expect(employeeService.create).toHaveBeenCalledWith({ name: 'Kalle', email: 'kalle@example.com' })
  expect(await screen.findByRole('status')).toHaveTextContent('Added Kalle. An invitation was sent to kalle@example.com.')
  expect(await screen.findByText('invited (kalle@example.com)')).toBeInTheDocument()
})

test('without email on the server, the manager gets the invitation link to pass on', async () => {
  const url = 'http://localhost/?invite=abc123'
  employeeService.create.mockResolvedValue({ ...INVITED, inviteSent: { email: 'kalle@example.com', sent: false, url } })
  render(<EmployeesPage />)

  await userEvent.click(await screen.findByRole('button', { name: 'Add employee' }))
  const form = screen.getByRole('form', { name: 'Add employee' })
  await userEvent.type(within(form).getByLabelText("Employee's name"), 'Kalle')
  await userEvent.type(within(form).getByLabelText('Email'), 'kalle@example.com')
  await userEvent.click(within(form).getByRole('button', { name: 'Add and invite' }))

  expect(await screen.findByLabelText('Invitation link')).toHaveValue(url)
  expect(screen.getByText(/send this invitation link to Kalle yourself/)).toBeInTheDocument()
})

test('an employee without a login can be invited, or invited again', async () => {
  employeeService.getDetails.mockResolvedValue([ANNA, LIISA, INVITED])
  employeeService.invite.mockResolvedValue({ email: 'x@example.com', sent: true })
  const prompt = vi.spyOn(window, 'prompt').mockReturnValue('liisa@example.com')
  render(<EmployeesPage />)

  await userEvent.click(within((await screen.findByText('Liisa')).closest('tr')).getByRole('button', { name: 'Invite' }))
  expect(employeeService.invite).toHaveBeenCalledWith(3, 'liisa@example.com')

  await userEvent.click(within(screen.getByText('Kalle').closest('tr')).getByRole('button', { name: 'Send invitation again' }))
  expect(employeeService.invite).toHaveBeenLastCalledWith(4, undefined)
  expect(prompt).toHaveBeenCalledTimes(1)
  prompt.mockRestore()
})

test('shows the backend error when adding fails', async () => {
  employeeService.create.mockRejectedValue({ response: { data: { error: 'email kalle@example.com is already in use' } } })
  render(<EmployeesPage />)

  await userEvent.click(await screen.findByRole('button', { name: 'Add employee' }))
  const form = screen.getByRole('form', { name: 'Add employee' })
  await userEvent.type(within(form).getByLabelText("Employee's name"), 'Kalle')
  await userEvent.type(within(form).getByLabelText('Email'), 'kalle@example.com')
  await userEvent.click(within(form).getByRole('button', { name: 'Add and invite' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('email kalle@example.com is already in use')
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

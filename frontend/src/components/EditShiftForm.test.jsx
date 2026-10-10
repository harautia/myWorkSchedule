import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import EditShiftForm from './EditShiftForm'
import { setBarSettings } from '../utils/dates'

const employees = [
  { id: 1, name: 'Anna', role: 'manager', color: '#863bff' },
  { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }
]
const shift = { id: 7, employeeId: 2, start: new Date(2026, 8, 25, 20), end: new Date(2026, 8, 26, 2) }

const renderForm = (props) =>
  render(<EditShiftForm shift={shift} employees={employees} onSave={vi.fn()} onDelete={vi.fn()} onCancel={vi.fn()} {...props} />)

test('shows the shift and saves changed times on the same bar day', async () => {
  const onSave = vi.fn().mockResolvedValue()
  renderForm({ onSave })

  expect(screen.getByRole('heading')).toHaveTextContent('Shift on Friday 25.9.')
  expect(screen.getByLabelText('Employee')).toHaveValue('2')
  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Anna (manager)')
  await userEvent.clear(screen.getByLabelText('End'))
  await userEvent.type(screen.getByLabelText('End'), '03:00')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(onSave).toHaveBeenCalledWith({ employeeId: 1, start: new Date(2026, 8, 25, 20), end: new Date(2026, 8, 26, 3) })
})

test('deletes the shift', async () => {
  const onDelete = vi.fn().mockResolvedValue()
  renderForm({ onDelete })
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
  expect(onDelete).toHaveBeenCalled()
})

test('shows the backend error, e.g. when the week was locked meanwhile', async () => {
  const onSave = vi.fn().mockRejectedValue({ response: { data: { error: 'the week of 2026-09-21 is locked' } } })
  renderForm({ onSave })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('is locked')
})

test('time inputs stay 24-hour when the bar uses the 12-hour clock', () => {
  setBarSettings({ timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', clock24h: false })
  try {
    renderForm()
    // <input type="time"> only accepts HH:mm; the browser shows it the user's way.
    expect(screen.getByLabelText('Start')).toHaveValue('20:00')
    expect(screen.getByLabelText('End')).toHaveValue('02:00')
  } finally {
    setBarSettings({ timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', clock24h: true })
  }
})

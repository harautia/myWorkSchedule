import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import NewShiftForm from './NewShiftForm'

const employees = [
  { id: 1, name: 'Anna', role: 'manager', color: '#863bff' },
  { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }
]
const friday = new Date(2026, 8, 25)

const renderForm = (props) =>
  render(<NewShiftForm employees={employees} day={friday} startMinutes={600} onSave={vi.fn()} onCancel={vi.fn()} {...props} />)

test('starts at the clicked time and lasts 8 hours, up to closing', () => {
  renderForm()
  expect(screen.getByLabelText('Bar day')).toHaveValue('2026-09-25')
  expect(screen.getByLabelText('Start')).toHaveValue('20:00')
  expect(screen.getByLabelText('End')).toHaveValue('04:00') // closing, not 04:00 + 4h
})

test('a shift past midnight ends on the next calendar day', async () => {
  const onSave = vi.fn().mockResolvedValue()
  renderForm({ onSave })

  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Mikko (waiter)')
  await userEvent.clear(screen.getByLabelText('End'))
  await userEvent.type(screen.getByLabelText('End'), '02:00')
  await userEvent.click(screen.getByRole('button', { name: 'Add shift' }))

  expect(onSave).toHaveBeenCalledWith({
    employeeId: 2,
    start: new Date(2026, 8, 25, 20),
    end: new Date(2026, 8, 26, 2)
  })
})

test('a shift ending before it starts is refused', async () => {
  const onSave = vi.fn()
  renderForm({ onSave, startMinutes: 480 }) // 18:00

  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Anna (manager)')
  await userEvent.clear(screen.getByLabelText('End'))
  await userEvent.type(screen.getByLabelText('End'), '12:00')
  await userEvent.click(screen.getByRole('button', { name: 'Add shift' }))

  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByRole('alert')).toHaveTextContent('must end after it starts')
})

test('shows the backend error when saving fails', async () => {
  const onSave = vi.fn().mockRejectedValue({ response: { data: { error: 'unknown employee' } } })
  renderForm({ onSave })

  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Anna (manager)')
  await userEvent.click(screen.getByRole('button', { name: 'Add shift' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('unknown employee')
})

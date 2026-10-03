import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import NewShiftForm from './NewShiftForm'
import shiftService from '../services/shifts'

vi.mock('../services/shifts')

const employees = [
  { id: 1, name: 'Anna', role: 'manager', color: '#863bff' },
  { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }
]
const friday = new Date(2026, 8, 25)

beforeEach(() => {
  vi.resetAllMocks()
  // The week of Monday 28.9. is locked.
  shiftService.getWeeks.mockResolvedValue({ '2026-09-28': { status: 'locked' } })
})

const renderForm = (props) =>
  render(<NewShiftForm employees={employees} day={friday} startMinutes={600} onSave={vi.fn()} onCancel={vi.fn()} {...props} />)

const dayButton = (name) => screen.getByRole('button', { name: new RegExp(`^${name}`) })

test('starts at the clicked day and time and lasts 8 hours, up to closing', async () => {
  renderForm()
  expect(dayButton('Friday 25.9.2026')).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByText('Chosen: Fri 25.9.')).toBeInTheDocument()
  expect(screen.getByLabelText('Start')).toHaveValue('20:00')
  expect(screen.getByLabelText('End')).toHaveValue('04:00') // closing, not 04:00 + 4h
  expect(await screen.findByRole('button', { name: 'Monday 28.9.2026 (week locked)' })).toBeDisabled()
})

test('adds the same shift on every chosen day in one go', async () => {
  const onSave = vi.fn().mockResolvedValue()
  renderForm({ onSave })

  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Mikko (waiter)')
  await userEvent.click(dayButton('Wednesday 23.9.2026'))
  await userEvent.click(dayButton('Saturday 26.9.2026'))
  await userEvent.clear(screen.getByLabelText('End'))
  await userEvent.type(screen.getByLabelText('End'), '02:00')
  await userEvent.click(screen.getByRole('button', { name: 'Add 3 shifts' }))

  expect(onSave).toHaveBeenCalledWith([
    { employeeId: 2, start: new Date(2026, 8, 23, 20), end: new Date(2026, 8, 24, 2) },
    { employeeId: 2, start: new Date(2026, 8, 25, 20), end: new Date(2026, 8, 26, 2) },
    { employeeId: 2, start: new Date(2026, 8, 26, 20), end: new Date(2026, 8, 27, 2) }
  ])
})

test('clicking a chosen day removes it; with no days nothing can be added', async () => {
  renderForm()
  await userEvent.click(dayButton('Friday 25.9.2026'))

  expect(dayButton('Friday 25.9.2026')).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Add shift' })).toBeDisabled()
})

test('days can be chosen from another month', async () => {
  const onSave = vi.fn().mockResolvedValue()
  renderForm({ onSave })

  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Anna (manager)')
  await userEvent.click(screen.getByRole('button', { name: 'Next month' }))
  expect(screen.getByText('October 2026')).toBeInTheDocument()
  await userEvent.click(dayButton('Friday 16.10.2026'))
  await userEvent.click(screen.getByRole('button', { name: 'Add 2 shifts' }))

  expect(onSave.mock.calls[0][0].map((s) => s.start)).toEqual([new Date(2026, 8, 25, 20), new Date(2026, 9, 16, 20)])
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
  const onSave = vi.fn().mockRejectedValue({ response: { data: { error: 'the week of 2026-09-21 is locked' } } })
  renderForm({ onSave })

  await userEvent.selectOptions(screen.getByLabelText('Employee'), 'Anna (manager)')
  await userEvent.click(screen.getByRole('button', { name: 'Add shift' }))

  expect(await screen.findByRole('alert')).toHaveTextContent('the week of 2026-09-21 is locked')
})

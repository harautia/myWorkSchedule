import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import SchedulePage from './SchedulePage'
import shiftService from '../services/shifts'
import { weekStart } from '../utils/dates'
import { dayKey } from '../utils/lanes'

vi.mock('../services/shifts')

// A shift this evening, so it is in the week shown first.
const today = new Date()
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18)
const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23)
const WEEK = dayKey(weekStart(today))

const PLANNING = { status: 'planning', lockedAt: null, lockedBy: null, published: false }
const LOCKED = { status: 'locked', lockedAt: '2026-10-01T11:05:00Z', lockedBy: 'Anna', published: true }

const withWeek = (status) => shiftService.getWeeks.mockResolvedValue({ [WEEK]: status })

beforeEach(() => {
  vi.resetAllMocks()
  shiftService.getEmployees.mockResolvedValue([{ id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }])
  shiftService.getShifts.mockResolvedValue([{ id: 7, employeeId: 2, start: start.toISOString(), end: end.toISOString() }])
  shiftService.getDayOrders.mockResolvedValue({})
  withWeek(PLANNING)
})

const editControls = (container) => container.querySelector('.is-draggable, .is-creatable, .shift-resize, .shift-delete')

test('employees see the schedule without any way to change it', async () => {
  withWeek(LOCKED)
  const { container } = render(<SchedulePage canEdit={false} />)

  expect(await screen.findByText('Mikko', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText('View only: ask a manager to change shifts.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /week|Add shift/ })).not.toBeInTheDocument()
  expect(editControls(container)).toBeNull()
})

test('employees are told when the week hasn\'t been published', async () => {
  shiftService.getShifts.mockResolvedValue([])
  render(<SchedulePage canEdit={false} />)

  expect(await screen.findByText('This week\'s schedule hasn\'t been published yet.')).toBeInTheDocument()
})

test('managers can add, drag and delete shifts in a week being planned', async () => {
  const { container } = render(<SchedulePage canEdit />)

  expect(await screen.findByRole('button', { name: /Delete shift of Mikko/ })).toBeInTheDocument()
  expect(screen.getByText('Planning')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add shift' })).toBeInTheDocument()
  expect(container.querySelector('.is-draggable')).not.toBeNull()
  expect(container.querySelector('.is-creatable')).not.toBeNull()
})

test('a locked week can\'t be changed, only unlocked', async () => {
  withWeek(LOCKED)
  const { container } = render(<SchedulePage canEdit />)

  expect(await screen.findByRole('button', { name: 'Unlock week' })).toBeInTheDocument()
  expect(screen.getByText(/Locked .* by Anna\. Employees see this week\./)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
  expect(editControls(container)).toBeNull()
})

test('locking the week publishes it and stops editing', async () => {
  shiftService.lockWeek.mockResolvedValue(LOCKED)
  const { container } = render(<SchedulePage canEdit />)

  await userEvent.click(await screen.findByRole('button', { name: 'Lock week' }))

  expect(shiftService.lockWeek).toHaveBeenCalledWith(WEEK)
  expect(await screen.findByRole('button', { name: 'Unlock week' })).toBeInTheDocument()
  expect(editControls(container)).toBeNull()
})

test('unlocking asks first and says employees keep the locked version', async () => {
  withWeek(LOCKED)
  shiftService.unlockWeek.mockResolvedValue({ ...LOCKED, status: 'planning' })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<SchedulePage canEdit />)

  await userEvent.click(await screen.findByRole('button', { name: 'Unlock week' }))

  expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/keep seeing the locked version/))
  expect(shiftService.unlockWeek).toHaveBeenCalledWith(WEEK)
  expect(await screen.findByText(/Employees see the version locked .* by Anna/)).toBeInTheDocument()
  confirm.mockRestore()
})

test('a refused change shows why and reloads the schedule', async () => {
  shiftService.deleteShift.mockRejectedValue({ response: { data: { error: 'the week of 2026-09-28 is locked' } } })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  render(<SchedulePage canEdit />)
  await userEvent.click(await screen.findByRole('button', { name: /Delete shift of Mikko/ }))

  expect(await screen.findByRole('alert')).toHaveTextContent('the week of 2026-09-28 is locked')
  expect(shiftService.getWeeks).toHaveBeenCalledTimes(2)
  confirm.mockRestore()
})

test('shifts chosen on several days are saved in one request', async () => {
  const created = (day) => ({
    id: 100 + day,
    employeeId: 2,
    start: new Date(today.getFullYear(), today.getMonth(), day, 12).toISOString(),
    end: new Date(today.getFullYear(), today.getMonth(), day, 18).toISOString()
  })
  shiftService.createShifts.mockImplementation((shifts) => Promise.resolve(shifts.map((_, i) => created(i + 1))))
  render(<SchedulePage canEdit />)

  await userEvent.click(await screen.findByRole('button', { name: 'Add shift' }))
  const form = await screen.findByRole('form', { name: 'New shift' })
  await userEvent.selectOptions(within(form).getByLabelText('Employee'), 'Mikko (waiter)')
  // Today is chosen already; add another day of this month.
  const other = within(form).getAllByRole('button', { pressed: false }).find((b) => !b.disabled && /\d/.test(b.textContent))
  await userEvent.click(other)
  await userEvent.click(within(form).getByRole('button', { name: 'Add 2 shifts' }))

  expect(shiftService.createShifts).toHaveBeenCalledTimes(1)
  expect(shiftService.createShifts.mock.calls[0][0]).toHaveLength(2)
  expect(screen.queryByRole('form', { name: 'New shift' })).not.toBeInTheDocument()
})

import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import SchedulePage from './SchedulePage'
import shiftService from '../services/shifts'

vi.mock('../services/shifts')

// A shift this evening, so it is in the week shown first.
const today = new Date()
const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18)
const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23)

beforeEach(() => {
  vi.resetAllMocks()
  shiftService.getEmployees.mockResolvedValue([{ id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }])
  shiftService.getShifts.mockResolvedValue([{ id: 7, employeeId: 2, start: start.toISOString(), end: end.toISOString() }])
  shiftService.getDayOrders.mockResolvedValue({})
})

test('employees see the schedule without any way to change it', async () => {
  const { container } = render(<SchedulePage canEdit={false} />)

  expect(await screen.findByText('Mikko', { selector: 'strong' })).toBeInTheDocument()
  expect(screen.getByText('View only: ask a manager to change shifts.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add shift' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Delete shift/ })).not.toBeInTheDocument()
  expect(container.querySelector('.is-draggable, .is-creatable, .shift-resize')).toBeNull()
})

test('managers can add, drag and delete shifts', async () => {
  const { container } = render(<SchedulePage canEdit />)

  expect(await screen.findByRole('button', { name: /Delete shift of Mikko/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Add shift' })).toBeInTheDocument()
  expect(container.querySelector('.is-draggable')).not.toBeNull()
  expect(container.querySelector('.is-creatable')).not.toBeNull()
})

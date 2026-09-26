import { fireEvent, render, screen, within } from '@testing-library/react'
import WeekView from './WeekView'
import { weekDays } from '../utils/dates'

const employeesById = {
  1: { id: 1, name: 'Anna', role: 'manager', color: '#863bff' },
  2: { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }
}

const days = weekDays(new Date(2026, 8, 24))
const shifts = [
  { id: 1, employeeId: 1, start: new Date(2026, 8, 21, 10), end: new Date(2026, 8, 21, 18) },
  // overnight Wednesday → Thursday
  { id: 2, employeeId: 2, start: new Date(2026, 8, 23, 18), end: new Date(2026, 8, 24, 2) }
]

test('renders shifts in the column of the day they start', () => {
  render(<WeekView days={days} shifts={shifts} employeesById={employeesById} today={days[0]} />)
  const columns = screen.getAllByTestId('week-column')
  expect(columns).toHaveLength(7)
  expect(within(columns[0]).getByText('Anna')).toBeInTheDocument()
  expect(within(columns[2]).getByText('Mikko')).toBeInTheDocument()
  expect(within(columns[2]).getByText('18–02')).toBeInTheDocument()
  expect(within(columns[3]).queryByText('Mikko')).not.toBeInTheDocument()
})

test('positions an overnight shift as one continuous block', () => {
  render(<WeekView days={days} shifts={shifts} employeesById={employeesById} today={days[0]} />)
  const block = screen.getByText('Mikko').closest('.shift-block')
  expect(block.style.top).toBe('320px') // 8h after 10:00 × 40px
  expect(block.style.height).toBe('320px') // 8h long
})

const drag = (element, dy) => {
  fireEvent.pointerDown(element, { button: 0, clientX: 0, clientY: 0 })
  fireEvent.pointerMove(window, { clientX: 0, clientY: dy })
  fireEvent.pointerUp(window)
}

test('dragging a shift moves it in 15 minute steps', () => {
  const onShiftChange = vi.fn()
  render(<WeekView days={days} shifts={shifts} employeesById={employeesById} today={days[0]} onShiftChange={onShiftChange} />)
  drag(screen.getByText('Anna').closest('.shift-block'), 50) // 1h15min at 40px/h
  expect(onShiftChange).toHaveBeenCalledWith(1, {
    start: new Date(2026, 8, 21, 11, 15),
    end: new Date(2026, 8, 21, 19, 15)
  })
})

test('dragging the bottom edge changes only the end time', () => {
  const onShiftChange = vi.fn()
  const { container } = render(<WeekView days={days} shifts={shifts} employeesById={employeesById} today={days[0]} onShiftChange={onShiftChange} />)
  drag(container.querySelector('.shift-resize'), -40)
  expect(onShiftChange).toHaveBeenCalledWith(1, {
    start: new Date(2026, 8, 21, 10),
    end: new Date(2026, 8, 21, 17)
  })
})

test('a click without movement does not change the shift', () => {
  const onShiftChange = vi.fn()
  render(<WeekView days={days} shifts={shifts} employeesById={employeesById} today={days[0]} onShiftChange={onShiftChange} />)
  drag(screen.getByText('Anna').closest('.shift-block'), 3)
  expect(onShiftChange).not.toHaveBeenCalled()
})

test('lays out employees in the saved order for the day', () => {
  const monday = [
    { id: 1, employeeId: 1, start: new Date(2026, 8, 21, 10), end: new Date(2026, 8, 21, 18) },
    { id: 3, employeeId: 2, start: new Date(2026, 8, 21, 12), end: new Date(2026, 8, 21, 20) }
  ]
  render(
    <WeekView days={days} shifts={monday} employeesById={employeesById} today={days[0]}
      dayOrders={{ '2026-09-21': [2, 1] }} />
  )
  expect(screen.getByText('Mikko').closest('.shift-block').style.left).toBe('0%')
  expect(screen.getByText('Anna').closest('.shift-block').style.left).toBe('50%')
})

test('moving a shift only in time does not change the order', () => {
  const onOrderChange = vi.fn()
  render(<WeekView days={days} shifts={shifts} employeesById={employeesById} today={days[0]}
    onShiftChange={() => {}} onOrderChange={onOrderChange} />)
  drag(screen.getByText('Anna').closest('.shift-block'), 80)
  expect(onOrderChange).not.toHaveBeenCalled()
})

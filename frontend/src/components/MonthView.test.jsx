import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MonthView from './MonthView'
import { monthGrid } from '../utils/dates'

const employeesById = {
  1: { id: 1, name: 'Anna', role: 'manager', color: '#863bff' }
}
const currentDate = new Date(2026, 8, 15)
const days = monthGrid(currentDate)

const shiftsOn = (day, count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    employeeId: 1,
    start: new Date(2026, 8, day, 10 + i),
    end: new Date(2026, 8, day, 16 + i)
  }))

const renderMonth = (shifts, onSelectDay = () => {}) =>
  render(
    <MonthView
      days={days}
      currentDate={currentDate}
      shifts={shifts}
      employeesById={employeesById}
      today={currentDate}
      onSelectDay={onSelectDay}
    />
  )

test('renders a 6-week grid with shift chips', () => {
  renderMonth(shiftsOn(10, 1))
  expect(screen.getAllByTestId('month-day')).toHaveLength(42)
  expect(screen.getByText('Anna 10–16')).toBeInTheDocument()
})

test('collapses extra shifts into "+N more"', () => {
  renderMonth(shiftsOn(10, 5))
  expect(screen.getAllByText(/^Anna/)).toHaveLength(3)
  expect(screen.getByText('+2 more')).toBeInTheDocument()
})

test('clicking a day number selects that day', async () => {
  const onSelectDay = vi.fn()
  renderMonth([], onSelectDay)
  await userEvent.click(screen.getByLabelText('Show week of Thursday 10.9.2026'))
  expect(onSelectDay).toHaveBeenCalledWith(new Date(2026, 8, 10))
})

test('marks the days of locked weeks, with a lock on the Monday', () => {
  render(
    <MonthView days={days} currentDate={currentDate} shifts={[]} employeesById={employeesById}
      today={days[0]} lockedWeeks={new Set(['2026-09-14'])} onSelectDay={() => {}} />
  )
  const cells = screen.getAllByTestId('month-day')
  // The grid starts on Monday 31.8., so 14.9. is at index 14.
  expect(cells.slice(14, 21).every((cell) => cell.classList.contains('is-locked'))).toBe(true)
  expect(cells[21]).not.toHaveClass('is-locked')
  expect(screen.getAllByTitle('Week locked')).toHaveLength(1)
})

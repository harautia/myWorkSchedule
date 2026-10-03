import { render, screen, within } from '@testing-library/react'
import MyShiftsList from './MyShiftsList'

const mikko = { id: 2, name: 'Mikko', role: 'waiter', color: '#1c7ed6' }
// Weeks 39 and 40 of 2026
const weekStarts = [new Date(2026, 8, 21), new Date(2026, 8, 28)]
const shifts = [
  { id: 1, employeeId: 2, start: new Date(2026, 8, 22, 16), end: new Date(2026, 8, 23, 0) },
  // Friday night shift that ends after midnight
  { id: 2, employeeId: 2, start: new Date(2026, 8, 25, 20), end: new Date(2026, 8, 26, 2, 30) }
]
const published = { status: 'locked', published: true }
const unpublished = { status: 'planning', published: false }

const renderList = (props) =>
  render(
    <MyShiftsList weekStarts={weekStarts} shifts={shifts} employee={mikko} today={new Date(2026, 8, 25, 12)}
      weeks={{ '2026-09-21': published, '2026-09-28': unpublished }} canEdit={false} {...props} />
  )

test('lists the shifts by week with times and length', () => {
  renderList()
  const week39 = screen.getByRole('region', { name: 'Week 39' })
  const items = within(week39).getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Tue 22.9.16:00–00:008 h')
  expect(items[1]).toHaveTextContent('Fri 25.9.20:00–02:306 h 30 min')
  expect(items[1]).toHaveClass('is-today')
  expect(items[0]).toHaveClass('is-past')
})

test('employees are told when a week is not published yet', () => {
  renderList()
  expect(within(screen.getByRole('region', { name: 'Week 40' })).getByText('Not published yet.')).toBeInTheDocument()
})

test('managers see their own planned weeks, marked as planning', () => {
  renderList({ canEdit: true })
  const week40 = screen.getByRole('region', { name: 'Week 40' })
  expect(within(week40).getByText('Planning')).toBeInTheDocument()
  expect(within(week40).getByText('No shifts.')).toBeInTheDocument()
})

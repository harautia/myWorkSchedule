import { render, screen } from '@testing-library/react'
import GroupBadges from './GroupBadges'
import i18n from '../i18n'

beforeEach(() => {
  i18n.changeLanguage('en')
})

test('the owner gets an Owner badge next to Manager', () => {
  render(<GroupBadges groups={['managerGroup']} role="owner" />)
  expect(screen.getByText('Manager')).toBeInTheDocument()
  expect(screen.getByText('Owner')).toBeInTheDocument()
})

test('other managers and employees have no Owner badge', () => {
  render(<GroupBadges groups={['managerGroup']} role="manager" />)
  render(<GroupBadges groups={['employeeGroup']} role="employee" />)
  expect(screen.queryByText('Owner')).not.toBeInTheDocument()
})

test('Finnish', async () => {
  await i18n.changeLanguage('fi')
  render(<GroupBadges groups={['managerGroup']} role="owner" />)
  expect(screen.getByText('Omistaja')).toBeInTheDocument()
})

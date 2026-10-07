import { render, screen } from '@testing-library/react'
import AppFooter from './AppFooter'

test('shows who runs this copy, from the server settings', () => {
  render(
    <AppFooter info={{
      version: '0.1.0',
      operatorName: 'Corner Pub Oy',
      contactEmail: 'it@cornerpub.example',
      privacyUrl: 'https://cornerpub.example/privacy',
      sourceUrl: 'https://git.cornerpub.example/schedule'
    }} />
  )

  expect(screen.getByText(/myWorkSchedule 0\.1\.0/)).toBeInTheDocument()
  expect(screen.getByText('Run by Corner Pub Oy')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'it@cornerpub.example' })).toHaveAttribute('href', 'mailto:it@cornerpub.example')
  expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', 'https://cornerpub.example/privacy')
  expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://git.cornerpub.example/schedule')
})

test('always links to the source code, even before the settings load', () => {
  render(<AppFooter info={null} />)

  expect(screen.getByRole('link', { name: 'Source code' })).toHaveAttribute('href', 'https://github.com/harautia/myWorkSchedule')
  expect(screen.queryByText(/Run by/)).not.toBeInTheDocument()
})

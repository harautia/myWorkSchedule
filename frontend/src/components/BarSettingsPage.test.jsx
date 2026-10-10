import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import BarSettingsPage from './BarSettingsPage'
import barService from '../services/bar'

vi.mock('../services/bar')

const BAR = {
  id: 1, name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', locale: 'en', clock24h: true, accentColor: '#863bff'
}

beforeEach(() => vi.resetAllMocks())

test('shows the current settings and saves the changes', async () => {
  barService.updateBar.mockImplementation((settings) => Promise.resolve({ id: 1, ...settings }))
  const onSaved = vi.fn()
  render(<BarSettingsPage bar={BAR} onSaved={onSaved} />)

  expect(screen.getByLabelText('Timezone')).toHaveValue('Europe/Helsinki')
  await userEvent.selectOptions(screen.getByLabelText('Language'), 'Suomi')
  await userEvent.clear(screen.getByLabelText('Opens'))
  await userEvent.type(screen.getByLabelText('Opens'), '16:00')
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

  expect(barService.updateBar).toHaveBeenCalledWith({
    name: 'Imaginary Bar', timezone: 'Europe/Helsinki', opensAt: '16:00', closesAt: '04:00', locale: 'fi', clock24h: true, accentColor: '#863bff'
  })
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ locale: 'fi', opensAt: '16:00' }))
  expect(await screen.findByRole('status')).toHaveTextContent('Settings saved')
})

test('shows the backend error', async () => {
  barService.updateBar.mockRejectedValue({ response: { data: { error: 'opensAt and closesAt must differ' } } })
  render(<BarSettingsPage bar={BAR} onSaved={vi.fn()} />)

  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('must differ')
})

test('the timezone is chosen from a list of all timezones', async () => {
  barService.updateBar.mockImplementation((settings) => Promise.resolve({ id: 1, ...settings }))
  render(<BarSettingsPage bar={BAR} onSaved={vi.fn()} />)

  // Not only the current zone is offered, as a text field with suggestions would.
  const timezone = screen.getByLabelText('Timezone')
  expect(timezone.querySelectorAll('option').length).toBeGreaterThan(300)
  await userEvent.selectOptions(timezone, 'America/New_York')
  expect(screen.getByText(/^Time there now: \d\d:\d\d$/)).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }))

  expect(barService.updateBar).toHaveBeenCalledWith(expect.objectContaining({ timezone: 'America/New_York' }))
})

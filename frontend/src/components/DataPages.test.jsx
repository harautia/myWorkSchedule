import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import BarSettingsPage from './BarSettingsPage'
import PeopleSection from './admin/PeopleSection'
import { DeletionBanner } from './StatusBanners'
import adminService from '../services/admin'
import barService from '../services/bar'
import i18n from '../i18n'

vi.mock('../services/admin', async (importOriginal) => ({ ...(await importOriginal()), default: {
  findPerson: vi.fn(),
  erasePerson: vi.fn()
} }))
vi.mock('../services/bar', async (importOriginal) => ({ ...(await importOriginal()), default: {
  updateBar: vi.fn(),
  scheduleDeletion: vi.fn(),
  cancelDeletion: vi.fn()
} }))

const BAR = { id: 1, name: 'Own Bar', timezone: 'Europe/Helsinki', opensAt: '10:00', closesAt: '04:00', locale: 'en', clock24h: true, accentColor: '#863bff', scheduledDeletionAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  i18n.changeLanguage('en')
})

describe('the owner\'s data', () => {
  test('downloads, and deleting the bar in 30 days', async () => {
    barService.scheduleDeletion.mockResolvedValue({ ...BAR, scheduledDeletionAt: '2026-11-10T10:00:00Z' })
    const onSaved = vi.fn()
    render(<BarSettingsPage bar={BAR} onSaved={onSaved} isOwner />)

    expect(screen.getByRole('link', { name: 'Download all data (JSON)' })).toHaveAttribute('href', '/api/bar/export?format=json')
    expect(screen.getByRole('link', { name: 'Download shifts (CSV)' })).toHaveAttribute('href', '/api/bar/export?format=csv')

    const button = screen.getByRole('button', { name: 'Delete bar in 30 days' })
    expect(button).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Type the bar name to confirm'), 'Own Bar')
    await userEvent.click(button)
    expect(barService.scheduleDeletion).toHaveBeenCalledWith('Own Bar')
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ scheduledDeletionAt: '2026-11-10T10:00:00Z' }))
  })

  test('a scheduled deletion can be undone', async () => {
    barService.cancelDeletion.mockResolvedValue(BAR)
    const onSaved = vi.fn()
    render(<BarSettingsPage bar={{ ...BAR, scheduledDeletionAt: '2026-11-10T10:00:00Z' }} onSaved={onSaved} isOwner />)

    expect(screen.getByText('This bar will be deleted on 10 Nov 2026.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Undo deletion' }))
    expect(barService.cancelDeletion).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith(BAR)
  })

  test('other managers see only the settings', () => {
    render(<BarSettingsPage bar={BAR} onSaved={vi.fn()} />)
    expect(screen.queryByRole('link', { name: 'Download all data (JSON)' })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Delete bar' })).not.toBeInTheDocument()
  })

  test('everyone sees the deletion date; the owner can go undo it', async () => {
    const onSettings = vi.fn()
    render(<DeletionBanner date="2026-11-10T10:00:00Z" onSettings={onSettings} />)
    expect(screen.getByRole('status')).toHaveTextContent('This bar will be deleted on 10 Nov 2026.')
    await userEvent.click(screen.getByRole('button', { name: 'Undo in Bar settings' }))
    expect(onSettings).toHaveBeenCalled()
  })
})

describe('personal data requests', () => {
  test('find a person, download their data, erase them', async () => {
    adminService.findPerson.mockResolvedValue({ id: 7, name: 'Mikko', email: 'mikko@example.com', isAdmin: false, bars: [{ id: 1, name: 'Own Bar', role: 'employee' }] })
    adminService.erasePerson.mockResolvedValue()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<PeopleSection />)

    await userEvent.type(screen.getByLabelText('Email'), 'mikko@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByText(/Own Bar – Employee/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Download their data' })).toHaveAttribute('href', '/api/admin/people/7/export')

    await userEvent.click(screen.getByRole('button', { name: 'Erase' }))
    expect(adminService.erasePerson).toHaveBeenCalledWith(7)
    expect(await screen.findByRole('status')).toHaveTextContent('mikko@example.com was erased.')
    confirm.mockRestore()
  })

  test('nobody found', async () => {
    adminService.findPerson.mockRejectedValue({ response: { data: { error: 'nobody has this email' } } })
    render(<PeopleSection />)
    await userEvent.type(screen.getByLabelText('Email'), 'x@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Find' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('nobody has this email')
  })
})

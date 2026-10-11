import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import BillingPage from './BillingPage'
import BarList from './admin/BarList'
import SupportSection from './admin/SupportSection'
import { SubscriptionBanner, SupportBanner } from './StatusBanners'
import adminService from '../services/admin'
import billingService from '../services/billing'
import i18n from '../i18n'

vi.mock('../services/admin')
vi.mock('../services/billing')

beforeEach(() => {
  vi.resetAllMocks()
  i18n.changeLanguage('en')
})

const BILLING = {
  status: 'trialing',
  trialEndsAt: '2026-11-10T10:00:00Z',
  billingInterval: 'month',
  currentPeriodEndsAt: '2026-11-10T10:00:00Z',
  cancelAtPeriodEnd: false,
  endedAt: null,
  lockedAt: null,
  scheduledDeletionAt: null,
  barCount: 1,
  hasCustomer: true,
  canSubscribe: false
}

describe('billing page', () => {
  test('a new owner starts the trial in Stripe Checkout, monthly or yearly', async () => {
    billingService.getBilling.mockResolvedValue({ ...BILLING, status: 'incomplete', trialEndsAt: null, billingInterval: null, hasCustomer: false, canSubscribe: true })
    billingService.startCheckout.mockResolvedValue('https://checkout.stripe.test/cs')
    const navigate = vi.fn()
    render(<BillingPage navigate={navigate} />)

    expect(await screen.findByText('Not started')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Manage billing' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText(/Yearly: €100 per bar a year/))
    await userEvent.click(screen.getByRole('button', { name: 'Start free trial' }))

    expect(billingService.startCheckout).toHaveBeenCalledWith('year')
    expect(navigate).toHaveBeenCalledWith('https://checkout.stripe.test/cs')
  })

  test('during the trial: its end, the plan, and the portal', async () => {
    billingService.getBilling.mockResolvedValue(BILLING)
    billingService.openPortal.mockResolvedValue('https://billing.stripe.test/portal')
    const navigate = vi.fn()
    render(<BillingPage navigate={navigate} />)

    expect(await screen.findByText(/Your free trial ends on 10 Nov 2026/)).toBeInTheDocument()
    expect(screen.getByText('1 bar: €10 a month, without VAT')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Subscribe' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Manage billing' }))
    expect(navigate).toHaveBeenCalledWith('https://billing.stripe.test/portal')
  })

  test('locked: when the data goes, and subscribing again', async () => {
    billingService.getBilling.mockResolvedValue({
      ...BILLING, status: 'locked', endedAt: '2026-09-01T10:00:00Z', lockedAt: '2026-09-15T10:00:00Z', scheduledDeletionAt: '2026-11-30T10:00:00Z', canSubscribe: true
    })
    render(<BillingPage navigate={vi.fn()} />)

    expect(await screen.findByText(/data will be deleted on 30 Nov 2026/)).toBeInTheDocument()
    expect(screen.getByText('Charged now for 1 bar.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Subscribe' })).toBeInTheDocument()
  })

  test('errors from the server are shown', async () => {
    billingService.getBilling.mockResolvedValue({ ...BILLING, status: 'read_only', lockedAt: '2026-10-25T10:00:00Z', scheduledDeletionAt: '2026-12-10T10:00:00Z', canSubscribe: true })
    billingService.startCheckout.mockRejectedValue({ response: { data: { error: 'Stripe is down' } } })
    render(<BillingPage navigate={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Subscribe' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Stripe is down')
  })
})

describe('banners', () => {
  const owner = { role: 'owner', subscriptionStatus: 'past_due', groups: ['managerGroup'] }

  test('payment failed: the owner is led to billing; staff are told the owner knows', async () => {
    const onBilling = vi.fn()
    const { unmount } = render(<SubscriptionBanner user={owner} onBilling={onBilling} />)
    expect(screen.getByRole('status')).toHaveTextContent('The last payment failed')
    await userEvent.click(screen.getByRole('button', { name: 'Go to Billing' }))
    expect(onBilling).toHaveBeenCalled()
    unmount()

    render(<SubscriptionBanner user={{ ...owner, role: 'employee' }} onBilling={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('The owner has been told')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  test('nothing to say for a running subscription', () => {
    const { container } = render(<SubscriptionBanner user={{ ...owner, subscriptionStatus: 'active' }} onBilling={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('support mode can be left', async () => {
    const onLeave = vi.fn()
    render(<SupportBanner barName="Own Bar" onLeave={onLeave} />)
    expect(screen.getByRole('status')).toHaveTextContent('Support mode: viewing Own Bar read-only.')
    await userEvent.click(screen.getByRole('button', { name: 'Leave support mode' }))
    expect(onLeave).toHaveBeenCalled()
  })
})

describe('admin: organizations', () => {
  const ORGANIZATIONS = [
    { id: 1, name: 'Imaginary Oy', country: 'FI', subscriptionStatus: 'past_due', trialEndsAt: null, bars: [{ id: 5, name: 'Imaginary Bar' }], activeUsers: 4, lastActiveAt: '2026-10-11T08:00:00Z' }
  ]

  test('lists organizations with their bars and subscription, and filters them', async () => {
    adminService.getOrganizations.mockResolvedValue(ORGANIZATIONS)
    const onOpen = vi.fn()
    render(<BarList onOpen={onOpen} onNew={vi.fn()} hosted />)

    const row = (await screen.findByText('Imaginary Oy')).closest('tr')
    expect(within(row).getByText('Payment failed')).toBeInTheDocument()
    expect(within(row).getByText('4')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Subscription'), 'past_due')
    expect(adminService.getOrganizations).toHaveBeenLastCalledWith({ search: '', status: 'past_due' })
    await userEvent.type(screen.getByLabelText('Search'), 'imag')
    expect(adminService.getOrganizations).toHaveBeenLastCalledWith({ search: 'imag', status: 'past_due' })

    await userEvent.click(within(row).getByRole('button', { name: 'Imaginary Bar' }))
    expect(onOpen).toHaveBeenCalledWith(5)
  })

  test('self-hosted: no subscription column or filter', async () => {
    adminService.getOrganizations.mockResolvedValue(ORGANIZATIONS)
    render(<BarList onOpen={vi.fn()} onNew={vi.fn()} hosted={false} />)
    await screen.findByText('Imaginary Oy')
    expect(screen.queryByLabelText('Subscription')).not.toBeInTheDocument()
    expect(screen.queryByText('Payment failed')).not.toBeInTheDocument()
  })
})

describe('admin: support mode', () => {
  test('opens the bar with a reason and shows the audit log', async () => {
    adminService.getAuditLog.mockResolvedValue([
      { id: 1, action: 'support.open', actorName: 'Admin', details: { reason: 'Ticket 7' }, createdAt: '2026-10-10T08:00:00Z' }
    ])
    adminService.openSupport.mockResolvedValue()
    const onSupport = vi.fn()
    render(<SupportSection bar={{ id: 5, name: 'Imaginary Bar' }} onSupport={onSupport} />)

    expect(await screen.findByText(/Opened in support mode: Ticket 7/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Reason (e.g. ticket number)'), 'Ticket 8')
    await userEvent.click(screen.getByRole('button', { name: 'Open in support mode' }))
    expect(adminService.openSupport).toHaveBeenCalledWith(5, 'Ticket 8')
    expect(onSupport).toHaveBeenCalled()
  })
})

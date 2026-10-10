import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import LoginPage from './LoginPage'
import OnboardingChecklist from './OnboardingChecklist'
import SignupPage from './SignupPage'
import VerifyEmailBanner from './VerifyEmailBanner'
import VerifyEmailPage from './VerifyEmailPage'
import barService from '../services/bar'
import signupService from '../services/signup'
import i18n from '../i18n'

vi.mock('../services/bar')
vi.mock('../services/signup')
vi.mock('../services/auth')
vi.mock('../services/accountLinks')

beforeEach(() => {
  vi.resetAllMocks()
  i18n.changeLanguage('en')
})

const fillSignup = async () => {
  await userEvent.type(screen.getByLabelText('Your name'), 'Maija Owner')
  await userEvent.type(screen.getByLabelText('Email'), 'maija@example.com')
  await userEvent.type(screen.getByLabelText('New password'), 'maija-password')
  await userEvent.type(screen.getByLabelText('Repeat the password'), 'maija-password')
  await userEvent.type(screen.getByLabelText('Bar name'), 'Corner Pub')
  await userEvent.selectOptions(screen.getByLabelText('Country'), 'FI')
  await userEvent.selectOptions(screen.getByLabelText('Timezone'), 'Europe/Helsinki')
}

describe('login page', () => {
  test('offers sign-up only when it is open', async () => {
    const { unmount } = render(<LoginPage onLogin={vi.fn()} emailEnabled={false} />)
    expect(screen.queryByRole('button', { name: 'Create an account' })).not.toBeInTheDocument()
    unmount()

    const onSignup = vi.fn()
    render(<LoginPage onLogin={vi.fn()} emailEnabled={false} onSignup={onSignup} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create an account' }))
    expect(onSignup).toHaveBeenCalled()
  })
})

describe('sign-up page', () => {
  test('creates the owner and the bar', async () => {
    signupService.signup.mockResolvedValue({ id: 5, name: 'Maija Owner' })
    const onSignup = vi.fn()
    render(<SignupPage turnstileSiteKey={null} onSignup={onSignup} onCancel={vi.fn()} />)

    await fillSignup()
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))

    expect(signupService.signup).toHaveBeenCalledWith({
      name: 'Maija Owner',
      email: 'maija@example.com',
      password: 'maija-password',
      barName: 'Corner Pub',
      country: 'FI',
      timezone: 'Europe/Helsinki',
      opensAt: '10:00',
      closesAt: '02:00',
      locale: 'en',
      captchaToken: null
    })
    expect(onSignup).toHaveBeenCalledWith({ id: 5, name: 'Maija Owner' })
  })

  test('the passwords must match, and server errors are shown', async () => {
    signupService.signup.mockRejectedValue({ response: { data: { error: 'an account with this email already exists' } } })
    render(<SignupPage turnstileSiteKey={null} onSignup={vi.fn()} onCancel={vi.fn()} />)

    await fillSignup()
    await userEvent.type(screen.getByLabelText('Repeat the password'), 'x')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByRole('alert')).toHaveTextContent('The passwords don\'t match')
    expect(signupService.signup).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Repeat the password'))
    await userEvent.type(screen.getByLabelText('Repeat the password'), 'maija-password')
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists')
  })

  test('choosing Finnish switches the form to Finnish', async () => {
    render(<SignupPage turnstileSiteKey={null} onSignup={vi.fn()} onCancel={vi.fn()} />)
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'fi')
    expect(screen.getByLabelText('Baarin nimi')).toBeInTheDocument()
    // Countries are named in the chosen language.
    expect(within(screen.getByLabelText('Maa')).getByRole('option', { name: 'Suomi' })).toHaveValue('FI')
  })
})

describe('email verification', () => {
  test('the link page confirms the address once', async () => {
    signupService.verifyEmail.mockResolvedValue()
    const onDone = vi.fn()
    render(<VerifyEmailPage token="abc" onDone={onDone} />)

    expect(await screen.findByRole('status')).toHaveTextContent('your email address is confirmed')
    expect(signupService.verifyEmail).toHaveBeenCalledTimes(1)
    expect(signupService.verifyEmail).toHaveBeenCalledWith('abc')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(onDone).toHaveBeenCalled()
  })

  test('an old link says so', async () => {
    signupService.verifyEmail.mockRejectedValue({ response: { data: { error: 'this link is no longer valid' } } })
    render(<VerifyEmailPage token="old" onDone={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer valid')
  })

  test('the banner sends a new link', async () => {
    signupService.resendVerification.mockResolvedValue()
    render(<VerifyEmailBanner email="maija@example.com" />)

    expect(screen.getByRole('status')).toHaveTextContent('we sent a link to maija@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send the link again' }))
    expect(signupService.resendVerification).toHaveBeenCalled()
    expect(await screen.findByText('A new link was sent to maija@example.com.')).toBeInTheDocument()
  })
})

describe('onboarding checklist', () => {
  test('ticks the done steps and leads to the next one', async () => {
    barService.getOnboarding.mockResolvedValue({ invite: true, plan: false, lock: false, dismissed: false })
    const onGo = vi.fn()
    render(<OnboardingChecklist onGo={onGo} />)

    expect(await screen.findByRole('heading', { name: 'Get your bar started' })).toBeInTheDocument()
    expect(screen.getByText('Invite your staff').closest('li')).toHaveClass('is-done')
    expect(screen.getByText('Plan the first week').closest('li')).not.toHaveClass('is-done')
    expect(screen.queryByRole('button', { name: 'Go to Employees' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open the schedule' }))
    expect(onGo).toHaveBeenCalledWith('schedule')
  })

  test('can be hidden for good', async () => {
    barService.getOnboarding.mockResolvedValue({ invite: false, plan: false, lock: false, dismissed: false })
    barService.dismissOnboarding.mockResolvedValue({ dismissed: true })
    render(<OnboardingChecklist onGo={vi.fn()} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Hide this list' }))
    expect(barService.dismissOnboarding).toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Get your bar started' })).not.toBeInTheDocument()
  })

  test('is not shown once dismissed', async () => {
    barService.getOnboarding.mockResolvedValue({ invite: true, plan: true, lock: true, dismissed: true })
    const { container } = render(<OnboardingChecklist onGo={vi.fn()} />)
    await vi.waitFor(() => expect(barService.getOnboarding).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import AcceptInvitePage from './AcceptInvitePage'
import LoginPage from './LoginPage'
import ResetPasswordPage from './ResetPasswordPage'
import accountLinkService from '../services/accountLinks'
import authService from '../services/auth'
import i18n from '../i18n'

vi.mock('../services/accountLinks')
vi.mock('../services/auth')

beforeEach(() => {
  vi.resetAllMocks()
  i18n.changeLanguage('en')
})

describe('login page', () => {
  test('logs in with an email or username', async () => {
    authService.login.mockResolvedValue({ id: 3 })
    const onLogin = vi.fn()
    render(<LoginPage onLogin={onLogin} emailEnabled={false} />)

    await userEvent.type(screen.getByLabelText('Email or username'), ' mikko@example.com ')
    await userEvent.type(screen.getByLabelText('Password'), 'secret')
    await userEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(authService.login).toHaveBeenCalledWith('mikko@example.com', 'secret')
    expect(onLogin).toHaveBeenCalledWith({ id: 3 })
    expect(screen.queryByRole('button', { name: 'Forgot password?' })).not.toBeInTheDocument()
  })

  test('"forgot password" sends a link, without telling whether the account exists', async () => {
    accountLinkService.requestPasswordReset.mockResolvedValue()
    render(<LoginPage onLogin={vi.fn()} emailEnabled />)

    await userEvent.click(screen.getByRole('button', { name: 'Forgot password?' }))
    await userEvent.type(screen.getByLabelText('Email'), 'mikko@example.com')
    await userEvent.click(screen.getByRole('button', { name: 'Send link' }))

    expect(accountLinkService.requestPasswordReset).toHaveBeenCalledWith('mikko@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent('If an account has this email')
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
  })
})

describe('invitation page', () => {
  test('greets the person in the bar\'s language and creates the account', async () => {
    accountLinkService.getInvite.mockResolvedValue({ name: 'Kalle', email: 'kalle@example.com', barName: 'Own Bar', locale: 'fi' })
    accountLinkService.acceptInvite.mockResolvedValue({ id: 9, name: 'Kalle' })
    const onLogin = vi.fn()
    render(<AcceptInvitePage token="abc" onLogin={onLogin} onCancel={vi.fn()} />)

    expect(await screen.findByText(/Hei Kalle, sinut on lisätty baarin Own Bar/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Uusi salasana'), 'kalle-password')
    await userEvent.type(screen.getByLabelText('Toista salasana'), 'kalle-pasword')
    await userEvent.click(screen.getByRole('button', { name: 'Luo tili' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Salasanat eivät täsmää')
    expect(accountLinkService.acceptInvite).not.toHaveBeenCalled()

    await userEvent.clear(screen.getByLabelText('Toista salasana'))
    await userEvent.type(screen.getByLabelText('Toista salasana'), 'kalle-password')
    await userEvent.click(screen.getByRole('button', { name: 'Luo tili' }))
    expect(accountLinkService.acceptInvite).toHaveBeenCalledWith('abc', 'kalle-password')
    expect(onLogin).toHaveBeenCalledWith({ id: 9, name: 'Kalle' })
  })

  test('an invalid invitation says so', async () => {
    accountLinkService.getInvite.mockRejectedValue({ response: { data: { error: 'this invitation is no longer valid' } } })
    render(<AcceptInvitePage token="old" onLogin={vi.fn()} onCancel={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent('no longer valid')
    expect(screen.queryByRole('button', { name: 'Create account' })).not.toBeInTheDocument()
  })
})

describe('password reset page', () => {
  test('sets the new password', async () => {
    accountLinkService.resetPassword.mockResolvedValue()
    render(<ResetPasswordPage token="r1" onDone={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-password')
    await userEvent.type(screen.getByLabelText('Repeat the password'), 'brand-new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))

    expect(accountLinkService.resetPassword).toHaveBeenCalledWith('r1', 'brand-new-password')
    expect(await screen.findByRole('status')).toHaveTextContent('Your password has been changed')
  })

  test('shows why a link doesn\'t work', async () => {
    accountLinkService.resetPassword.mockRejectedValue({ response: { data: { error: 'this link is no longer valid' } } })
    render(<ResetPasswordPage token="r1" onDone={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('New password'), 'brand-new-password')
    await userEvent.type(screen.getByLabelText('Repeat the password'), 'brand-new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Save password' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('no longer valid')
  })
})

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import accountLinkService from '../services/accountLinks'
import authService from '../services/auth'

// Log in with an email address or a username. "Forgot password?" is only
// offered when the server can send email (emailEnabled).
const LoginPage = ({ onLogin, emailEnabled }) => {
  const { t } = useTranslation()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [forgotten, setForgotten] = useState(false)
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const user = await authService.login(login.trim(), password)
      onLogin(user)
    } catch (err) {
      setError(err.response?.data?.error ?? t('login.failed'))
      setSubmitting(false)
    }
  }

  const handleForgot = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await accountLinkService.requestPasswordReset(login.trim())
      setNotice(t('login.resetSent'))
      setForgotten(false)
    } catch (err) {
      setError(err.response?.data?.error ?? t('common.error'))
    }
    setSubmitting(false)
  }

  if (forgotten) {
    return (
      <main className="login-page">
        <form className="login-card" onSubmit={handleForgot} aria-label={t('login.forgotTitle')}>
          <img src="/App-logo.png" alt="" width="48" height="48" />
          <h1>{t('login.forgotTitle')}</h1>
          <p className="field-hint">{t('login.forgotHint')}</p>
          <label className="form-field">
            {t('login.email')}
            <input type="email" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="email" autoFocus required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {t('login.sendLink')}
          </button>
          <button type="button" className="link-button" onClick={() => setForgotten(false)}>
            {t('links.toLogin')}
          </button>
        </form>
      </main>
    )
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/App-logo.png" alt="" width="48" height="48" />
        <h1>{t('login.title')}</h1>
        {notice && <p className="form-notice" role="status">{notice}</p>}
        <label className="form-field">
          {t('login.emailOrUsername')}
          <input
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <label className="form-field">
          {t('login.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t('login.submitting') : t('login.submit')}
        </button>
        {emailEnabled && (
          <button type="button" className="link-button" onClick={() => { setNotice(null); setError(null); setForgotten(true) }}>
            {t('login.forgot')}
          </button>
        )}
      </form>
    </main>
  )
}

export default LoginPage

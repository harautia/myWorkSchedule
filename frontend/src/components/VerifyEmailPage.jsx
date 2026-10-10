import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import signupService from '../services/signup'
import { errorMessage } from '../utils/forms'

// The page behind the link in the welcome email: confirms the address.
const VerifyEmailPage = ({ token, onDone }) => {
  const { t } = useTranslation()
  // undefined = checking, true = confirmed, false = failed
  const [verified, setVerified] = useState(undefined)
  const [error, setError] = useState(null)
  // The link works only once, so it is sent only once (React's development
  // mode runs effects twice).
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    signupService
      .verifyEmail(token)
      .then(() => setVerified(true))
      .catch((err) => {
        setVerified(false)
        setError(errorMessage(err))
      })
  }, [token])

  return (
    <main className="login-page">
      <section className="login-card" aria-label={t('verify.title')}>
        <img src="/App-logo.png" alt="" width="48" height="48" />
        <h1>{t('verify.title')}</h1>
        {verified === undefined && <p className="page-note">{t('app.loading')}</p>}
        {verified && <p className="form-notice" role="status">{t('verify.done')}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {verified !== undefined && (
          <button type="button" className="btn btn-primary" onClick={onDone}>
            {t('verify.continue')}
          </button>
        )}
      </section>
    </main>
  )
}

export default VerifyEmailPage

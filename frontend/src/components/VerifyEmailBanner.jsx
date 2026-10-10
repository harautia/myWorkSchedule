import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import signupService from '../services/signup'
import { errorMessage } from '../utils/forms'

// Reminds someone who signed up to confirm their email; inviting staff waits
// for it. They can ask for a new link.
const VerifyEmailBanner = ({ email }) => {
  const { t } = useTranslation()
  const [status, setStatus] = useState(null)
  const [sending, setSending] = useState(false)

  const handleResend = async () => {
    setSending(true)
    try {
      await signupService.resendVerification()
      setStatus({ ok: true, text: t('verify.resent', { email }) })
    } catch (err) {
      setStatus({ ok: false, text: errorMessage(err) })
    }
    setSending(false)
  }

  return (
    <div className="notice-banner" role="status">
      <span>{t('verify.banner', { email })}</span>
      <button type="button" className="link-button" onClick={handleResend} disabled={sending}>
        {t('verify.resend')}
      </button>
      {status && <span className={status.ok ? undefined : 'form-error'}>{status.text}</span>}
    </div>
  )
}

export default VerifyEmailBanner

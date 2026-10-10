import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import NewPasswordFields from './NewPasswordFields'
import accountLinkService from '../services/accountLinks'
import { errorMessage } from '../utils/forms'

// The page behind a "forgot password" link: choose a new password, then log in.
const ResetPasswordPage = ({ token, onDone }) => {
  const { t } = useTranslation()
  const [passwords, setPasswords] = useState({ password: '', repeat: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (passwords.password !== passwords.repeat) return setError(t('links.passwordsDiffer'))
    setSaving(true)
    setError(null)
    try {
      await accountLinkService.resetPassword(token, passwords.password)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err))
    }
    setSaving(false)
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit} aria-label={t('links.resetTitle')}>
        <img src="/App-logo.png" alt="" width="48" height="48" />
        <h1>{t('links.resetTitle')}</h1>
        {done ? (
          <p className="form-notice" role="status">{t('links.resetDone')}</p>
        ) : (
          <>
            <NewPasswordFields value={passwords} onChange={setPasswords} />
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? t('common.saving') : t('links.resetSave')}
            </button>
          </>
        )}
        <button type="button" className="link-button" onClick={onDone}>
          {t('links.toLogin')}
        </button>
      </form>
    </main>
  )
}

export default ResetPasswordPage

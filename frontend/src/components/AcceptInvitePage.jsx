import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NewPasswordFields from './NewPasswordFields'
import accountLinkService from '../services/accountLinks'
import { setLanguage } from '../i18n'
import { errorMessage } from '../utils/forms'

// The page behind an invitation link: the invited person chooses a password
// and is logged in. Shown in the bar's language.
const AcceptInvitePage = ({ token, onLogin, onCancel }) => {
  const { t } = useTranslation()
  const [invite, setInvite] = useState(undefined)
  const [passwords, setPasswords] = useState({ password: '', repeat: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    accountLinkService
      .getInvite(token)
      .then((data) => {
        setLanguage(data.locale)
        setInvite(data)
      })
      .catch((err) => {
        setInvite(null)
        setError(errorMessage(err))
      })
  }, [token])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (passwords.password !== passwords.repeat) return setError(t('links.passwordsDiffer'))
    setSaving(true)
    setError(null)
    try {
      onLogin(await accountLinkService.acceptInvite(token, passwords.password))
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit} aria-label={t('links.inviteTitle')}>
        <img src="/App-logo.png" alt="" width="48" height="48" />
        <h1>{t('links.inviteTitle')}</h1>
        {invite === undefined && <p className="page-note">{t('app.loading')}</p>}
        {invite && (
          <>
            <p>{t('links.inviteWelcome', { name: invite.name, bar: invite.barName })}</p>
            <p className="field-hint">{t('links.inviteEmail', { email: invite.email })}</p>
            <NewPasswordFields value={passwords} onChange={setPasswords} />
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {invite && (
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : t('links.inviteAccept')}
          </button>
        )}
        <button type="button" className="link-button" onClick={onCancel}>
          {t('links.toLogin')}
        </button>
      </form>
    </main>
  )
}

export default AcceptInvitePage

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// When the server can't send email, the manager passes the invitation link on
// themselves (e.g. by text message). link = { name, url }
const InviteLinkNotice = ({ link, onClose }) => {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      // No clipboard access: the link can still be selected and copied by hand.
    }
  }

  return (
    <div className="card invite-link" role="status">
      <p>{t('employees.inviteLinkText', { name: link.name })}</p>
      <span className="input-with-button">
        <input value={link.url} readOnly aria-label={t('employees.inviteLinkLabel')} onFocus={(e) => e.target.select()} />
        <button type="button" className="btn btn-nav" onClick={copy}>
          {copied ? t('employees.copied') : t('employees.copy')}
        </button>
      </span>
      <p className="field-hint">{t('employees.inviteLinkHint')}</p>
      <div className="form-actions">
        <button type="button" className="btn btn-nav" onClick={onClose}>
          {t('employees.done')}
        </button>
      </div>
    </div>
  )
}

export default InviteLinkNotice

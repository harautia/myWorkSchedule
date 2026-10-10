// Shown on every page. Who runs this copy comes from the server's settings
// (APP_OPERATOR_NAME etc.), not from the code. The source code link is
// required by the AGPL licence, so it is always shown.
import { useTranslation } from 'react-i18next'

const DEFAULT_SOURCE_URL = 'https://github.com/harautia/myWorkSchedule'

const AppFooter = ({ info }) => {
  const { t } = useTranslation()
  const parts = []
  if (info?.operatorName) parts.push(<span key="operator">{t('footer.runBy', { name: info.operatorName })}</span>)
  if (info?.contactEmail) {
    parts.push(<a key="contact" href={`mailto:${info.contactEmail}`}>{info.contactEmail}</a>)
  }
  if (info?.privacyUrl) parts.push(<a key="privacy" href={info.privacyUrl}>{t('footer.privacy')}</a>)
  parts.push(
    <span key="source">
      <a href={info?.sourceUrl || DEFAULT_SOURCE_URL}>{t('footer.source')}</a> (AGPL-3.0)
    </span>
  )

  return (
    <footer className="app-footer">
      <p>
        myWorkSchedule{info?.version ? ` ${info.version}` : ''}
        {parts.map((part) => (
          <span key={part.key}> · {part}</span>
        ))}
      </p>
    </footer>
  )
}

export default AppFooter

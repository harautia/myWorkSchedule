import { useTranslation } from 'react-i18next'
import { groupLabel } from '../i18n/labels'

// role is the account's role in the bar; the owner gets a badge of its own.
const GroupBadges = ({ groups, role }) => {
  const { t } = useTranslation()
  return (
    <span className="badges">
      {groups.map((group) => (
        <span key={group} className={`badge badge-${group}`}>
          {groupLabel(t, group)}
        </span>
      ))}
      {role === 'owner' && <span className="badge badge-owner">{t('groups.owner')}</span>}
    </span>
  )
}

export default GroupBadges

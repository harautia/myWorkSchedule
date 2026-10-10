import { useTranslation } from 'react-i18next'
import { groupLabel } from '../i18n/labels'

const GroupBadges = ({ groups }) => {
  const { t } = useTranslation()
  return (
    <span className="badges">
      {groups.map((group) => (
        <span key={group} className={`badge badge-${group}`}>
          {groupLabel(t, group)}
        </span>
      ))}
    </span>
  )
}

export default GroupBadges

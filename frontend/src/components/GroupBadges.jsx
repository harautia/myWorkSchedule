import { GROUP_LABELS } from '../utils/access'

const GroupBadges = ({ groups }) => (
  <span className="badges">
    {groups.map((group) => (
      <span key={group} className={`badge badge-${group}`}>
        {GROUP_LABELS[group] ?? group}
      </span>
    ))}
  </span>
)

export default GroupBadges

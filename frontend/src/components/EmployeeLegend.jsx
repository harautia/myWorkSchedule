import { useTranslation } from 'react-i18next'
import { roleLabel } from '../i18n/labels'

const EmployeeLegend = ({ employees, hiddenIds, onToggle }) => {
  const { t } = useTranslation()
  return (
    <ul className="legend" aria-label={t('legend.label')}>
      {employees.map((employee) => {
        const visible = !hiddenIds.has(employee.id)
        return (
          <li key={employee.id}>
            <button
              type="button"
              className={`legend-item${visible ? '' : ' is-hidden'}`}
              style={{ '--shift-color': employee.color }}
              aria-pressed={visible}
              onClick={() => onToggle(employee.id)}
            >
              <span className="legend-swatch" />
              {employee.name} <span className="legend-role">{roleLabel(t, employee.role)}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export default EmployeeLegend

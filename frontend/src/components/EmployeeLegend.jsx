const EmployeeLegend = ({ employees, hiddenIds, onToggle }) => (
  <ul className="legend" aria-label="Employees">
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
            {employee.name} <span className="legend-role">{employee.role}</span>
          </button>
        </li>
      )
    })}
  </ul>
)

export default EmployeeLegend

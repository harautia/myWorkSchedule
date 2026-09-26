import { useEffect, useState } from 'react'
import GroupBadges from './GroupBadges'
import employeeService from '../services/employees'

// managerGroup: everyone employed in the manager's own bar.
const EmployeesPage = () => {
  const [employees, setEmployees] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    employeeService
      .getDetails()
      .then(setEmployees)
      .catch(() => setError('Could not load employees'))
  }, [])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!employees) return <p className="page-note">Loading…</p>

  return (
    <section>
      <h2 className="page-title">Employees ({employees.length})</h2>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Login account</th>
              <th>Groups</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.id}>
                <td>
                  <span className="legend-swatch" style={{ '--shift-color': employee.color }} />{' '}
                  {employee.name}
                </td>
                <td>{employee.role}</td>
                <td>{employee.account ? employee.account.username : <span className="muted">none</span>}</td>
                <td>{employee.account && <GroupBadges groups={employee.account.groups} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default EmployeesPage

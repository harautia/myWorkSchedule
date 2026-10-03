import { Fragment, useCallback, useEffect, useState } from 'react'
import GroupBadges from './GroupBadges'
import AddEmployeeForm from './employees/AddEmployeeForm'
import EditEmployeeForm from './employees/EditEmployeeForm'
import employeeService from '../services/employees'
import { errorMessage } from '../utils/forms'
import { MANAGER } from '../utils/access'

const shiftsText = (count) => (count === 1 ? '1 shift' : `${count} shifts`)

// managerGroup: everyone employed in the manager's own bar. Employees can be
// added, renamed, given a new password and removed here; managers are
// managed by the admin.
const EmployeesPage = () => {
  const [employees, setEmployees] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)

  const load = useCallback(() => employeeService.getDetails().then(setEmployees), [])

  useEffect(() => {
    load().catch((err) => setLoadError(errorMessage(err, 'Could not load employees')))
  }, [load])

  if (loadError) return <p className="form-error" role="alert">{loadError}</p>
  if (!employees) return <p className="page-note">Loading…</p>

  const showNotice = (message) => {
    setNotice(message)
    setActionError(null)
  }

  const handleSaved = async (message) => {
    setEditingId(null)
    setAdding(false)
    showNotice(message)
    await load()
  }

  const handleRemove = async (employee) => {
    const loses = [employee.account && 'their login account', shiftsText(employee.shiftCount)]
      .filter(Boolean)
      .join(' and ')
    if (!window.confirm(`Remove ${employee.name}? This deletes ${loses}.`)) return
    try {
      await employeeService.remove(employee.id)
      showNotice(`Removed ${employee.name}`)
      await load()
    } catch (err) {
      setNotice(null)
      setActionError(errorMessage(err))
    }
  }

  return (
    <section>
      <div className="page-heading">
        <h2 className="page-title">Employees ({employees.length})</h2>
        {!adding && (
          <button type="button" className="btn btn-nav" onClick={() => setAdding(true)}>
            Add employee
          </button>
        )}
      </div>

      {notice && <p className="form-notice" role="status">{notice}</p>}
      {adding && <AddEmployeeForm onSaved={handleSaved} onCancel={() => setAdding(false)} />}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Login account</th>
              <th>Groups</th>
              <th>Shifts</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const isManager = Boolean(employee.account?.groups.includes(MANAGER))
              return (
                <Fragment key={employee.id}>
                  <tr>
                    <td>
                      <span className="legend-swatch" style={{ '--shift-color': employee.color }} />{' '}
                      {employee.name}
                    </td>
                    <td data-label="Role">{employee.role}</td>
                    <td data-label="Login">{employee.account ? employee.account.username : <span className="muted">none</span>}</td>
                    <td data-label="Groups">{employee.account && <GroupBadges groups={employee.account.groups} />}</td>
                    <td data-label="Shifts">{employee.shiftCount}</td>
                    <td className="row-actions">
                      {isManager && <span className="muted">managed by admin</span>}
                      {!isManager && editingId !== employee.id && (
                        <>
                          <button type="button" className="btn btn-nav" onClick={() => setEditingId(employee.id)}>
                            Edit
                          </button>
                          <button type="button" className="btn btn-danger" onClick={() => handleRemove(employee)}>
                            Remove
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {editingId === employee.id && (
                    <tr>
                      <td colSpan={6}>
                        <EditEmployeeForm
                          employee={employee}
                          onSaved={handleSaved}
                          onCancel={() => setEditingId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default EmployeesPage

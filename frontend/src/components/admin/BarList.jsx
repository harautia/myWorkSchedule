import { useEffect, useState } from 'react'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Every bar that uses the service.
const BarList = ({ notice, onOpen, onNew }) => {
  const [bars, setBars] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    adminService
      .getBars()
      .then(setBars)
      .catch((err) => setError(errorMessage(err, 'Could not load bars')))
  }, [])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!bars) return <p className="page-note">Loading…</p>

  return (
    <section>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <div className="page-heading">
        <h2 className="page-title">Bars using the service ({bars.length})</h2>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          New bar
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Opening hours</th>
              <th>Timezone</th>
              <th className="num">Employees</th>
              <th className="num">Users</th>
              <th>Customer since</th>
            </tr>
          </thead>
          <tbody>
            {bars.map((bar) => (
              <tr key={bar.id}>
                <td>
                  <button type="button" className="link-button" onClick={() => onOpen(bar.id)}>
                    {bar.name}
                  </button>
                </td>
                <td data-label="Open">{bar.opensAt}–{bar.closesAt}</td>
                <td data-label="Timezone">{bar.timezone}</td>
                <td className="num" data-label="Employees">{bar.employeeCount}</td>
                <td className="num" data-label="Users">{bar.userCount}</td>
                <td data-label="Created">{new Date(bar.createdAt).toLocaleDateString('fi-FI')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default BarList

import { useEffect, useState } from 'react'
import adminService from '../services/admin'

// adminGroup: every bar that uses the service.
const BarsPage = () => {
  const [bars, setBars] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    adminService
      .getBars()
      .then(setBars)
      .catch(() => setError('Could not load bars'))
  }, [])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!bars) return <p className="page-note">Loading…</p>

  return (
    <section>
      <h2 className="page-title">Bars using the service ({bars.length})</h2>
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
                <td>{bar.name}</td>
                <td>{bar.opensAt}–{bar.closesAt}</td>
                <td>{bar.timezone}</td>
                <td className="num">{bar.employeeCount}</td>
                <td className="num">{bar.userCount}</td>
                <td>{new Date(bar.createdAt).toLocaleDateString('fi-FI')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default BarsPage

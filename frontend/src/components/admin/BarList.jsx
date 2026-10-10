import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'

// Every bar that uses the service.
const BarList = ({ notice, onOpen, onNew }) => {
  const { t } = useTranslation()
  const [bars, setBars] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    adminService
      .getBars()
      .then(setBars)
      .catch((err) => setError(errorMessage(err, t('admin.loadBarsFailed'))))
  }, [t])

  if (error) return <p className="form-error" role="alert">{error}</p>
  if (!bars) return <p className="page-note">{t('app.loading')}</p>

  return (
    <section>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <div className="page-heading">
        <h2 className="page-title">{t('admin.barsTitle', { count: bars.length })}</h2>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          {t('admin.newBar')}
        </button>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('admin.columns.name')}</th>
              <th>{t('admin.columns.hours')}</th>
              <th>{t('admin.columns.timezone')}</th>
              <th className="num">{t('admin.columns.employees')}</th>
              <th className="num">{t('admin.columns.users')}</th>
              <th>{t('admin.columns.since')}</th>
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
                <td data-label={t('admin.columns.hours')}>{bar.opensAt}–{bar.closesAt}</td>
                <td data-label={t('admin.columns.timezone')}>{bar.timezone}</td>
                <td className="num" data-label={t('admin.columns.employees')}>{bar.employeeCount}</td>
                <td className="num" data-label={t('admin.columns.users')}>{bar.userCount}</td>
                <td data-label={t('admin.columns.since')}>{new Date(bar.createdAt).toLocaleDateString('fi-FI')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default BarList

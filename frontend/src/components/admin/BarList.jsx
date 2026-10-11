import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import adminService from '../../services/admin'
import { errorMessage } from '../../utils/forms'
import { formatDate, SUBSCRIPTION_STATUSES } from '../../utils/billing'

// Every organization using the service, with its bars (spec ADM-01). On the
// hosted service also the subscription status and trial end, with a filter.
const BarList = ({ notice, onOpen, onNew, hosted }) => {
  const { t, i18n } = useTranslation()
  const [organizations, setOrganizations] = useState(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    let current = true
    adminService
      .getOrganizations({ search: search.trim(), status })
      .then((data) => current && setOrganizations(data))
      .catch((err) => current && setError(errorMessage(err, t('admin.loadBarsFailed'))))
    return () => {
      current = false
    }
  }, [search, status, t])

  if (error) return <p className="form-error" role="alert">{error}</p>

  const barCount = organizations?.reduce((sum, organization) => sum + organization.bars.length, 0) ?? 0
  const date = (value) => (value ? formatDate(value, i18n.language) : '–')

  return (
    <section>
      {notice && <p className="form-notice" role="status">{notice}</p>}
      <div className="page-heading">
        <h2 className="page-title">{t('admin.barsTitle', { count: barCount })}</h2>
        <button type="button" className="btn btn-primary" onClick={onNew}>
          {t('admin.newBar')}
        </button>
      </div>
      <div className="list-filters">
        <label className="form-field">
          {t('admin.search')}
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
        {hosted && (
          <label className="form-field">
            {t('admin.columns.status')}
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t('admin.allStatuses')}</option>
              {[...SUBSCRIPTION_STATUSES, 'none'].map((value) => (
                <option key={value} value={value}>{t(`billing.status.${value}`)}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!organizations ? (
        <p className="page-note">{t('app.loading')}</p>
      ) : organizations.length === 0 ? (
        <p className="page-note">{t('admin.noMatches')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('admin.columns.organization')}</th>
                <th>{t('admin.columns.bars')}</th>
                {hosted && <th>{t('admin.columns.status')}</th>}
                {hosted && <th>{t('admin.columns.trialEnds')}</th>}
                <th className="num">{t('admin.columns.activeUsers')}</th>
                <th>{t('admin.columns.lastActive')}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id}>
                  <td>{organization.name}{organization.country && <span className="field-hint"> {organization.country}</span>}</td>
                  <td data-label={t('admin.columns.bars')}>
                    {organization.bars.map((bar) => (
                      <button key={bar.id} type="button" className="link-button" onClick={() => onOpen(bar.id)}>
                        {bar.name}
                      </button>
                    ))}
                  </td>
                  {hosted && (
                    <td data-label={t('admin.columns.status')}>
                      <span className={`badge badge-status-${organization.subscriptionStatus ?? 'none'}`}>
                        {t(`billing.status.${organization.subscriptionStatus ?? 'none'}`)}
                      </span>
                    </td>
                  )}
                  {hosted && <td data-label={t('admin.columns.trialEnds')}>{date(organization.trialEndsAt)}</td>}
                  <td className="num" data-label={t('admin.columns.activeUsers')}>{organization.activeUsers}</td>
                  <td data-label={t('admin.columns.lastActive')}>{date(organization.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default BarList

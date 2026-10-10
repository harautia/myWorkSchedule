import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import GroupBadges from './GroupBadges'
import AddEmployeeForm from './employees/AddEmployeeForm'
import EditEmployeeForm from './employees/EditEmployeeForm'
import InviteLinkNotice from './employees/InviteLinkNotice'
import employeeService from '../services/employees'
import { errorMessage } from '../utils/forms'
import { MANAGER } from '../utils/access'
import { roleLabel } from '../i18n/labels'

// managerGroup: everyone employed in the manager's own bar. Employees can be
// added, renamed, given a new password and removed here; managers are
// managed by the admin.
// The login column: the account's email or username, an open invitation, or none.
const loginText = (t, employee) => {
  if (employee.account) return employee.account.email ?? employee.account.username
  if (employee.invite) return <span className="muted">{t('employees.invited', { email: employee.invite.email })}</span>
  return <span className="muted">{t('employees.noLogin')}</span>
}

const EmployeesPage = () => {
  const { t } = useTranslation()
  const [employees, setEmployees] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  // An invitation link to pass on, when the server can't send email: { name, url }
  const [inviteLink, setInviteLink] = useState(null)

  const load = useCallback(() => employeeService.getDetails().then(setEmployees), [])

  useEffect(() => {
    load().catch((err) => setLoadError(errorMessage(err, t('employees.loadFailed'))))
  }, [load, t])

  if (loadError) return <p className="form-error" role="alert">{loadError}</p>
  if (!employees) return <p className="page-note">{t('app.loading')}</p>

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

  // The result of inviting someone: emailed, or a link for the manager to pass on.
  const showInvite = (name, { email, sent, url }) => {
    if (sent) {
      setInviteLink(null)
      showNotice(t('employees.inviteSent', { name, email }))
    } else {
      setNotice(null)
      setInviteLink({ name, url })
    }
  }

  const handleAdded = async (employee) => {
    setAdding(false)
    showInvite(employee.name, employee.inviteSent)
    await load()
  }

  const handleInvite = async (employee) => {
    let address
    if (!employee.invite) {
      address = window.prompt(t('employees.inviteEmailPrompt', { name: employee.name }))
      if (!address) return
    }
    try {
      showInvite(employee.name, await employeeService.invite(employee.id, address))
      await load()
    } catch (err) {
      setNotice(null)
      setActionError(errorMessage(err))
    }
  }

  const handleRemove = async (employee) => {
    const confirmKey = employee.account ? 'employees.removeConfirmWithLogin' : 'employees.removeConfirm'
    if (!window.confirm(t(confirmKey, { name: employee.name, count: employee.shiftCount }))) return
    try {
      await employeeService.remove(employee.id)
      showNotice(t('employees.removed', { name: employee.name }))
      await load()
    } catch (err) {
      setNotice(null)
      setActionError(errorMessage(err))
    }
  }

  return (
    <section>
      <div className="page-heading">
        <h2 className="page-title">{t('employees.title', { count: employees.length })}</h2>
        {!adding && (
          <button type="button" className="btn btn-nav" onClick={() => setAdding(true)}>
            {t('employees.add')}
          </button>
        )}
      </div>

      {notice && <p className="form-notice" role="status">{notice}</p>}
      {inviteLink && <InviteLinkNotice link={inviteLink} onClose={() => setInviteLink(null)} />}
      {adding && <AddEmployeeForm onSaved={handleAdded} onCancel={() => setAdding(false)} />}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('employees.columns.name')}</th>
              <th>{t('employees.columns.role')}</th>
              <th>{t('employees.columns.login')}</th>
              <th>{t('employees.columns.groups')}</th>
              <th>{t('employees.columns.shifts')}</th>
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
                    <td data-label={t('employees.columns.role')}>{roleLabel(t, employee.role)}</td>
                    <td data-label={t('employees.columns.login')}>{loginText(t, employee)}</td>
                    <td data-label={t('employees.columns.groups')}>{employee.account && <GroupBadges groups={employee.account.groups} />}</td>
                    <td data-label={t('employees.columns.shifts')}>{employee.shiftCount}</td>
                    <td className="row-actions">
                      {isManager && <span className="muted">{t('employees.managedByAdmin')}</span>}
                      {!isManager && editingId !== employee.id && (
                        <>
                          <button type="button" className="btn btn-nav" onClick={() => setEditingId(employee.id)}>
                            {t('common.edit')}
                          </button>
                          {!employee.account && (
                            <button type="button" className="btn btn-nav" onClick={() => handleInvite(employee)}>
                              {employee.invite ? t('employees.inviteAgain') : t('employees.invite')}
                            </button>
                          )}
                          <button type="button" className="btn btn-danger" onClick={() => handleRemove(employee)}>
                            {t('common.remove')}
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

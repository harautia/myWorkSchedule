import { Fragment, useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AddManagerForm from './AddManagerForm'
import BarFields from './BarFields'
import DeleteBarSection from './DeleteBarSection'
import EditManagerForm from './EditManagerForm'
import GroupBadges from '../GroupBadges'
import adminService from '../../services/admin'
import { barSettings, errorMessage } from '../../utils/forms'
import { MANAGER } from '../../utils/access'
import { roleLabel } from '../../i18n/labels'


// One bar: its settings, and every user account in it. Managers can be
// added, edited (name, new password) and removed here.
const BarDetail = ({ barId, onBack, onDeleted }) => {
  const { t } = useTranslation()
  const [details, setDetails] = useState(null)
  const [barForm, setBarForm] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [barError, setBarError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [adding, setAdding] = useState(false)
  const [savingBar, setSavingBar] = useState(false)

  const load = useCallback(
    () =>
      adminService.getBar(barId).then((data) => {
        setDetails(data)
        setBarForm(barSettings(data.bar))
      }),
    [barId]
  )

  useEffect(() => {
    load().catch((err) => setLoadError(errorMessage(err, t('admin.loadBarFailed'))))
  }, [load, t])

  if (loadError) return <p className="form-error" role="alert">{loadError}</p>
  if (!details) return <p className="page-note">{t('app.loading')}</p>

  const { bar, users } = details
  const managerCount = users.filter((user) => user.groups.includes(MANAGER)).length

  const showNotice = (message) => {
    setNotice(message)
    setActionError(null)
  }

  const handleSaveBar = async (event) => {
    event.preventDefault()
    setSavingBar(true)
    setBarError(null)
    try {
      const saved = await adminService.updateBar(barId, barForm)
      setDetails((prev) => ({ ...prev, bar: saved }))
      showNotice(t('admin.barSaved'))
    } catch (err) {
      setBarError(errorMessage(err))
    }
    setSavingBar(false)
  }

  const handleManagerSaved = async (message) => {
    setEditingId(null)
    setAdding(false)
    showNotice(message)
    await load()
  }

  const handleRemove = async (user) => {
    if (!window.confirm(t('admin.removeManagerConfirm', { name: user.name, username: user.username }))) return
    try {
      await adminService.removeManager(barId, user.id)
      showNotice(t('admin.managerRemoved', { username: user.username }))
      await load()
    } catch (err) {
      setNotice(null)
      setActionError(errorMessage(err))
    }
  }

  return (
    <section>
      <button type="button" className="link-button back-link" onClick={onBack}>
        {t('admin.allBars')}
      </button>
      <h2 className="page-title">{bar.name}</h2>

      {notice && <p className="form-notice" role="status">{notice}</p>}

      <form className="card" onSubmit={handleSaveBar} aria-label={t('barSettings.title')}>
        <h3 className="card-title">{t('barSettings.title')}</h3>
        <BarFields value={barForm} onChange={setBarForm} />
        {barError && <p className="form-error" role="alert">{barError}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={savingBar}>
            {savingBar ? t('common.saving') : t('barSettings.save')}
          </button>
        </div>
      </form>

      <div className="page-heading">
        <h3 className="card-title">{t('admin.usersTitle', { count: users.length })}</h3>
        {!adding && (
          <button type="button" className="btn btn-nav" onClick={() => setAdding(true)}>
            {t('admin.addManager')}
          </button>
        )}
      </div>
      {adding && <AddManagerForm barId={barId} onSaved={handleManagerSaved} onCancel={() => setAdding(false)} />}
      {actionError && <p className="form-error" role="alert">{actionError}</p>}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t('admin.columns.name')}</th>
              <th>{t('admin.columns.username')}</th>
              <th>{t('admin.columns.groups')}</th>
              <th>{t('admin.columns.onSchedule')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isManager = user.groups.includes(MANAGER)
              return (
                <Fragment key={user.id}>
                  <tr>
                    <td>{user.name}</td>
                    <td data-label={t('admin.columns.username')}>{user.username}</td>
                    <td data-label={t('admin.columns.groups')}><GroupBadges groups={user.groups} /></td>
                    <td data-label={t('admin.columns.onSchedule')}>
                      {user.employee
                        ? t('admin.employeeOnSchedule', { name: user.employee.name, role: roleLabel(t, user.employee.role) })
                        : <span className="muted">{t('admin.notLinked')}</span>}
                    </td>
                    <td className="row-actions">
                      {isManager && editingId !== user.id && (
                        <>
                          <button type="button" className="btn btn-nav" onClick={() => setEditingId(user.id)}>
                            {t('common.edit')}
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleRemove(user)}
                            disabled={managerCount <= 1}
                            title={managerCount <= 1 ? t('admin.lastManager') : undefined}
                          >
                            {t('common.remove')}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {editingId === user.id && (
                    <tr>
                      <td colSpan={5}>
                        <EditManagerForm
                          barId={barId}
                          manager={user}
                          onSaved={handleManagerSaved}
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
      <p className="page-note">
        {t('admin.employeesNote')}
      </p>

      <DeleteBarSection bar={bar} onDeleted={onDeleted} />
    </section>
  )
}

export default BarDetail

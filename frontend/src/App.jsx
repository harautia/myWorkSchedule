import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AcceptInvitePage from './components/AcceptInvitePage'
import AppFooter from './components/AppFooter'
import BarSettingsPage from './components/BarSettingsPage'
import BarsPage from './components/BarsPage'
import EmployeesPage from './components/EmployeesPage'
import GroupBadges from './components/GroupBadges'
import LoginPage from './components/LoginPage'
import ResetPasswordPage from './components/ResetPasswordPage'
import SchedulePage from './components/SchedulePage'
import appInfoService from './services/appInfo'
import authService from './services/auth'
import barService from './services/bar'
import { setUnauthorizedHandler } from './services/api'
import useOnline from './hooks/useOnline'
import { canEditSchedule, pagesFor } from './utils/access'
import { applyBarSettings } from './utils/barSettings'
import { clearLinkFromUrl, linkFromUrl } from './utils/links'

const App = () => {
  const { t } = useTranslation()
  // undefined = still checking the session, null = logged out
  const [user, setUser] = useState(undefined)
  const [page, setPage] = useState(null)
  const [appInfo, setAppInfo] = useState(null)
  // An invitation or password reset link the app was opened with.
  const [link, setLink] = useState(linkFromUrl)
  // The user's bar with its settings, and which bar it was loaded for: the
  // pages wait until it matches the logged-in user's bar.
  const [loadedBar, setLoadedBar] = useState({ forBarId: null, bar: null })
  const bar = loadedBar.bar
  const online = useOnline()

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    authService
      .getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
    // The footer works without it, e.g. offline.
    appInfoService.getAppInfo().then(setAppInfo).catch(() => {})
  }, [])

  // Every page shows dates and times the bar's way, so load its settings first.
  const barId = user?.barId
  useEffect(() => {
    if (!barId) {
      setLoadedBar({ forBarId: null, bar: null })
      document.documentElement.style.removeProperty('--accent')
      return
    }
    barService
      .getBar()
      .then((data) => {
        applyBarSettings(data)
        setLoadedBar({ forBarId: barId, bar: data })
      })
      // Without the settings (e.g. offline with nothing cached) the defaults are used.
      .catch(() => setLoadedBar({ forBarId: barId, bar: null }))
  }, [barId])

  const handleBarSaved = (saved) => {
    applyBarSettings(saved)
    setLoadedBar({ forBarId: saved.id, bar: saved })
  }

  const closeLink = () => {
    clearLinkFromUrl()
    setLink(null)
  }

  const handleInviteAccepted = (newUser) => {
    closeLink()
    setUser(newUser)
  }

  const handleLogout = async () => {
    await authService.logout()
    setUser(null)
    setPage(null)
  }

  // A link from an email comes first, even if someone is logged in.
  if (link?.type === 'invite') {
    return (
      <>
        <AcceptInvitePage token={link.token} onLogin={handleInviteAccepted} onCancel={closeLink} />
        <AppFooter info={appInfo} />
      </>
    )
  }
  if (link?.type === 'reset') {
    return (
      <>
        <ResetPasswordPage token={link.token} onDone={closeLink} />
        <AppFooter info={appInfo} />
      </>
    )
  }

  if (user === undefined) return <div className="app-loading">{t('app.checkingSession')}</div>
  if (user === null) {
    return (
      <>
        <LoginPage onLogin={setUser} emailEnabled={Boolean(appInfo?.emailEnabled)} />
        <AppFooter info={appInfo} />
      </>
    )
  }

  if (user.barId && loadedBar.forBarId !== user.barId) return <div className="app-loading">{t('app.loading')}</div>

  const pages = pagesFor(user)
  const activePage = pages.includes(page) ? page : pages[0]
  // The bar's current name, so a renamed bar shows at once.
  const barName = bar?.name ?? user.barName
  const title = barName ? t('app.title', { bar: barName }) : t('app.titleNoBar')

  return (
    <div>
      <header className="app-header">
        <img src="/App-logo.png" alt="" width="32" height="32" />
        <h1>{title}</h1>
        <div className="user-menu">
          <span className="user-name">{user.name}</span>
          <GroupBadges groups={user.groups} />
          <button type="button" className="btn btn-nav" onClick={handleLogout}>
            {t('app.logout')}
          </button>
        </div>
      </header>

      {!online && (
        <p className="offline-banner" role="status">
          {t('app.offline')}
        </p>
      )}

      {pages.length > 1 && (
        <nav aria-label={t('app.pagesLabel')}>
          {pages.map((key) => (
            <button
              key={key}
              type="button"
              className={`btn btn-nav${activePage === key ? ' is-active' : ''}`}
              aria-current={activePage === key ? 'page' : undefined}
              onClick={() => setPage(key)}
            >
              {t(`app.pages.${key}`)}
            </button>
          ))}
        </nav>
      )}

      {activePage === 'schedule' && <SchedulePage canEdit={canEditSchedule(user)} employeeId={user.employeeId} />}
      {activePage === 'employees' && <EmployeesPage />}
      {activePage === 'settings' && bar && <BarSettingsPage bar={bar} onSaved={handleBarSaved} />}
      {activePage === 'bars' && <BarsPage />}
      {!activePage && <p className="page-note">{t('app.noPages')}</p>}

      <AppFooter info={appInfo} />
    </div>
  )
}

export default App

import { useEffect, useState } from 'react'
import AppFooter from './components/AppFooter'
import BarSettingsPage from './components/BarSettingsPage'
import BarsPage from './components/BarsPage'
import EmployeesPage from './components/EmployeesPage'
import GroupBadges from './components/GroupBadges'
import LoginPage from './components/LoginPage'
import SchedulePage from './components/SchedulePage'
import appInfoService from './services/appInfo'
import authService from './services/auth'
import barService from './services/bar'
import { setUnauthorizedHandler } from './services/api'
import useOnline from './hooks/useOnline'
import { canEditSchedule, pagesFor } from './utils/access'
import { applyBarSettings } from './utils/barSettings'

const PAGE_LABELS = {
  schedule: 'Schedule',
  employees: 'Employees',
  settings: 'Bar settings',
  bars: 'Bars'
}

const App = () => {
  // undefined = still checking the session, null = logged out
  const [user, setUser] = useState(undefined)
  const [page, setPage] = useState(null)
  const [appInfo, setAppInfo] = useState(null)
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

  const handleLogout = async () => {
    await authService.logout()
    setUser(null)
    setPage(null)
  }

  if (user === undefined) return <div className="app-loading">Checking session…</div>
  if (user === null) {
    return (
      <>
        <LoginPage onLogin={setUser} />
        <AppFooter info={appInfo} />
      </>
    )
  }

  if (user.barId && loadedBar.forBarId !== user.barId) return <div className="app-loading">Loading…</div>

  const pages = pagesFor(user)
  const activePage = pages.includes(page) ? page : pages[0]
  // The bar's current name, so a renamed bar shows at once.
  const barName = bar?.name ?? user.barName
  const title = barName ? `${barName} Work Schedule` : 'Work Schedule Service'

  return (
    <div>
      <header className="app-header">
        <img src="/App-logo.png" alt="" width="32" height="32" />
        <h1>{title}</h1>
        <div className="user-menu">
          <span className="user-name">{user.name}</span>
          <GroupBadges groups={user.groups} />
          <button type="button" className="btn btn-nav" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      {!online && (
        <p className="offline-banner" role="status">
          You are offline. Showing the schedule as it was last loaded; changes can&apos;t be saved.
        </p>
      )}

      {pages.length > 1 && (
        <nav aria-label="Pages">
          {pages.map((key) => (
            <button
              key={key}
              type="button"
              className={`btn btn-nav${activePage === key ? ' is-active' : ''}`}
              aria-current={activePage === key ? 'page' : undefined}
              onClick={() => setPage(key)}
            >
              {PAGE_LABELS[key]}
            </button>
          ))}
        </nav>
      )}

      {activePage === 'schedule' && <SchedulePage canEdit={canEditSchedule(user)} employeeId={user.employeeId} />}
      {activePage === 'employees' && <EmployeesPage />}
      {activePage === 'settings' && bar && <BarSettingsPage bar={bar} onSaved={handleBarSaved} />}
      {activePage === 'bars' && <BarsPage />}
      {!activePage && <p className="page-note">Your account has no pages yet. Ask an admin to add you to a group.</p>}

      <AppFooter info={appInfo} />
    </div>
  )
}

export default App

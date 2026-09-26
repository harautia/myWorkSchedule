import { useEffect, useState } from 'react'
import BarsPage from './components/BarsPage'
import EmployeesPage from './components/EmployeesPage'
import GroupBadges from './components/GroupBadges'
import LoginPage from './components/LoginPage'
import SchedulePage from './components/SchedulePage'
import authService from './services/auth'
import { setUnauthorizedHandler } from './services/api'
import { canEditSchedule, pagesFor } from './utils/access'

const PAGE_LABELS = {
  schedule: 'Schedule',
  employees: 'Employees',
  bars: 'Bars'
}

const App = () => {
  // undefined = still checking the session, null = logged out
  const [user, setUser] = useState(undefined)
  const [page, setPage] = useState(null)

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null))
    authService
      .getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
  }, [])

  const handleLogout = async () => {
    await authService.logout()
    setUser(null)
    setPage(null)
  }

  if (user === undefined) return <div className="app-loading">Checking session…</div>
  if (user === null) return <LoginPage onLogin={setUser} />

  const pages = pagesFor(user)
  const activePage = pages.includes(page) ? page : pages[0]
  const title = user.barName ? `${user.barName} Work Schedule` : 'Work Schedule Service'

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

      {activePage === 'schedule' && <SchedulePage canEdit={canEditSchedule(user)} />}
      {activePage === 'employees' && <EmployeesPage />}
      {activePage === 'bars' && <BarsPage />}
      {!activePage && <p className="page-note">Your account has no pages yet. Ask an admin to add you to a group.</p>}

      <footer className="app-footer">
        <p>
          &copy; {new Date().getFullYear()} Riverbend Solutions &mdash; Hannu Rautiainen &mdash;{' '}
          <a href="mailto:harautia1976@gmail.com">harautia1976@gmail.com</a>
        </p>
      </footer>
    </div>
  )
}

export default App

import api from './api'
import { clearOfflineData } from './offline'

// user = { id, username, email, name, groups: [...], role, barId, barName,
//   organizationId, employeeId, emailVerified }

// login is an email address or a username.
const login = async (login, password) => {
  const res = await api.post('/login', { login, password })
  await clearOfflineData()
  return res.data
}

const logout = async () => {
  await clearOfflineData()
  return api.post('/logout')
}

// The logged-in user, or null when there is no valid session.
const getCurrentUser = () =>
  api
    .get('/me')
    .then((res) => res.data)
    .catch((error) => {
      if (error.response?.status === 401) return null
      throw error
    })

export default { login, logout, getCurrentUser }

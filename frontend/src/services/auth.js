import api from './api'

// user = { id, username, name, groups: [...], barId, barName, employeeId }

const login = (username, password) =>
  api.post('/login', { username, password }).then((res) => res.data)

const logout = () => api.post('/logout')

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

import axios from 'axios'

const api = axios.create({ baseURL: '/api', withCredentials: true })

// Called when the session has expired mid-use, so the app can show the login page.
let onUnauthorized = null
export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url ?? ''
    if (error.response?.status === 401 && url !== '/login' && url !== '/me' && onUnauthorized) {
      onUnauthorized()
    }
    return Promise.reject(error)
  }
)

export default api

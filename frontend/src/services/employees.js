import api from './api'

// managerGroup only: the bar's employees with their login account (or null).
const getDetails = () => api.get('/employees/details').then((res) => res.data)

export default { getDetails }

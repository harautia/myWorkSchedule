import api from './api'

// adminGroup only: every bar using the service, with employee/user counts.
const getBars = () => api.get('/admin/bars').then((res) => res.data)

export default { getBars }

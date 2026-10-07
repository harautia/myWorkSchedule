import api from './api'

// Public facts about this installation: { version, deploymentMode,
// operatorName, contactEmail, privacyUrl, sourceUrl }.
const getAppInfo = () => api.get('/app-info').then((res) => res.data)

export default { getAppInfo }

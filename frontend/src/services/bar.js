import api from './api'

// The logged-in user's bar: { id, name, timezone, opensAt, closesAt, locale,
// clock24h, accentColor }
const getBar = () => api.get('/bar').then((res) => res.data)

// managerGroup only: changes the bar's settings; returns the saved bar.
const updateBar = (settings) => api.put('/bar', settings).then((res) => res.data)

export default { getBar, updateBar }

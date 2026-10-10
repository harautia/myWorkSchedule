import api from './api'

// The logged-in user's bar: { id, name, timezone, opensAt, closesAt, locale,
// clock24h, accentColor }
const getBar = () => api.get('/bar').then((res) => res.data)

// managerGroup only: changes the bar's settings; returns the saved bar.
const updateBar = (settings) => api.put('/bar', settings).then((res) => res.data)

// managerGroup only: the new bar's checklist { invite, plan, lock, dismissed },
// each true when done.
const getOnboarding = () => api.get('/bar/onboarding').then((res) => res.data)

const dismissOnboarding = () => api.post('/bar/onboarding/dismiss').then((res) => res.data)

export default { getBar, updateBar, getOnboarding, dismissOnboarding }

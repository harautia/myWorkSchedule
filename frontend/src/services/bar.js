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

// The owner's data downloads (plain links: the browser saves the file).
export const EXPORT_URLS = { json: '/api/bar/export?format=json', csv: '/api/bar/export?format=csv' }

// Owner only: schedules the bar's deletion in 30 days (confirmName = the
// bar's name), or undoes it. Both return the bar with scheduledDeletionAt.
const scheduleDeletion = (confirmName) => api.post('/bar/deletion', { confirmName }).then((res) => res.data)
const cancelDeletion = () => api.delete('/bar/deletion').then((res) => res.data)

export default { getBar, updateBar, getOnboarding, dismissOnboarding, scheduleDeletion, cancelDeletion }

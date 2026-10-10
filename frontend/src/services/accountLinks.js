import api from './api'

// The pages behind links sent by email (no login needed).

// { name, email, barName, locale } of a valid invitation.
const getInvite = (token) => api.get(`/invites/${token}`).then((res) => res.data)

// Creates the account with the chosen password and logs in; returns the user.
const acceptInvite = (token, password) =>
  api.post(`/invites/${token}/accept`, { password }).then((res) => res.data)

// Emails a reset link if an account has this email (the answer never tells).
const requestPasswordReset = (email) => api.post('/password-reset', { email })

const resetPassword = (token, password) => api.post('/password-reset/confirm', { token, password })

export default { getInvite, acceptInvite, requestPasswordReset, resetPassword }

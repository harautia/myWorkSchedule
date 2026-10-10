import api from './api'
import { clearOfflineData } from './offline'

// { name, email, password, barName, country, timezone, opensAt, closesAt,
//   locale, captchaToken? }: creates the bar and its owner and logs in;
// returns the user.
const signup = async (details) => {
  const res = await api.post('/signup', details)
  await clearOfflineData()
  return res.data
}

// Confirms the email behind a /?verify= link (no login needed).
const verifyEmail = (token) => api.post('/verify-email', { token })

// Sends the logged-in user a new verification link.
const resendVerification = () => api.post('/verify-email/resend')

export default { signup, verifyEmail, resendVerification }

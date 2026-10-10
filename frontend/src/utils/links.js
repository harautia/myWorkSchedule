// Links from emails open the app as /?invite=TOKEN, /?reset=TOKEN or
// /?verify=TOKEN. The project website's "Start free trial" opens /?signup.

const TOKEN_LINKS = ['invite', 'reset', 'verify']

// { type: 'invite' | 'reset' | 'verify', token } or { type: 'signup' } from
// the current address, or null.
export const linkFromUrl = (search = window.location.search) => {
  const params = new URLSearchParams(search)
  const type = TOKEN_LINKS.find((name) => params.get(name))
  if (type) return { type, token: params.get(type) }
  if (params.has('signup')) return { type: 'signup' }
  return null
}

// Removes the token from the address bar once it has been used.
export const clearLinkFromUrl = () => window.history.replaceState(null, '', window.location.pathname)

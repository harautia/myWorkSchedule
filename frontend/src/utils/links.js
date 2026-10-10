// Links from emails open the app as /?invite=TOKEN or /?reset=TOKEN.

// { type: 'invite' | 'reset', token } from the current address, or null.
export const linkFromUrl = (search = window.location.search) => {
  const params = new URLSearchParams(search)
  if (params.get('invite')) return { type: 'invite', token: params.get('invite') }
  if (params.get('reset')) return { type: 'reset', token: params.get('reset') }
  return null
}

// Removes the token from the address bar once it has been used.
export const clearLinkFromUrl = () => window.history.replaceState(null, '', window.location.pathname)

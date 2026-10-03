// The service worker keeps the last loaded bar data (cache 'api', see
// vite.config.js) so the schedule can be shown offline. It belongs to the
// logged-in user, so it is removed when someone logs in or out.
export const clearOfflineData = async () => {
  if (typeof caches === 'undefined') return
  try {
    await caches.delete('api')
  } catch {
    // Nothing cached, or storage not available; nothing to remove.
  }
}

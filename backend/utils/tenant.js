// Decides which bar (tenant) the request acts on and stores it in
// request.barId. It is always the logged-in user's own bar. Controllers must
// only ever use request.barId, never a bar id from the URL or body, so a
// client can't reach another bar's data. Runs after requireAuth.
const resolveBar = (request, response, next) => {
  if (!request.user.barId) {
    return response.status(403).json({ error: 'user does not belong to a bar' })
  }
  request.barId = request.user.barId
  next()
}

module.exports = { resolveBar }

const config = require('./config')

// Decides which bar (tenant) the request acts on and stores it in
// request.barId. Controllers must only ever use request.barId, never a bar id
// from the URL or body, so a client can't reach another bar's data.
// Today this is always the default bar; once login exists it will come from
// the verified session token instead, and nothing else needs to change.
const resolveBar = (request, response, next) => {
  request.barId = config.DEFAULT_BAR_ID
  next()
}

module.exports = { resolveBar }

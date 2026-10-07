require('dotenv').config({ quiet: true })
const path = require('path')

const connectionString = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL

// Managed Postgres reached from outside its own private network (e.g. a
// hosted DB accessed over the public internet) typically requires SSL;
// same-network connections (like Render's internal database URL) don't
// need it, so this is opt-in via an env var rather than always-on.
const connection = process.env.DATABASE_SSL === 'true'
  ? { connectionString, ssl: { rejectUnauthorized: false } }
  : connectionString

module.exports = {
  client: 'pg',
  connection,
  // Absolute, so the server and knex CLI work from any working directory.
  migrations: {
    directory: path.join(__dirname, 'db', 'migrations')
  },
  seeds: {
    directory: path.join(__dirname, 'db', 'seeds')
  }
}

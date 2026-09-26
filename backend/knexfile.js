require('dotenv').config()

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
  migrations: {
    directory: './db/migrations'
  },
  seeds: {
    directory: './db/seeds'
  }
}

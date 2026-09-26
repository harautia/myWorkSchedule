require('dotenv').config()

const PORT = process.env.PORT || 3003

const DATABASE_URL = process.env.NODE_ENV === 'test'
  ? process.env.TEST_DATABASE_URL
  : process.env.DATABASE_URL

// Until login exists every request acts on this one bar.
const DEFAULT_BAR_ID = Number(process.env.DEFAULT_BAR_ID) || 1

module.exports = { PORT, DATABASE_URL, DEFAULT_BAR_ID }

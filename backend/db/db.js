const knex = require('knex')
const { types } = require('pg')
const knexConfig = require('../knexfile')

// Return DATE columns as plain 'yyyy-MM-dd' strings. The default parser turns
// them into Date objects at local midnight, which shifts the day in other
// timezones.
types.setTypeParser(1082, (value) => value)

module.exports = knex(knexConfig)

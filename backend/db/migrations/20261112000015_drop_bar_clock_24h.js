// Times are always shown on the 24-hour clock, so the per-bar 12/24-hour
// setting is gone.
exports.up = (knex) =>
  knex.schema.alterTable('bars', (table) => {
    table.dropColumn('clock_24h')
  })

exports.down = (knex) =>
  knex.schema.alterTable('bars', (table) => {
    table.boolean('clock_24h').notNullable().defaultTo(true)
  })

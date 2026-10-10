// How each bar's own view looks: its language, 12/24-hour clock and accent
// colour. Timezone and opening hours already exist.
exports.up = (knex) =>
  knex.schema.alterTable('bars', (table) => {
    table.text('locale').notNullable().defaultTo('en')
    table.boolean('clock_24h').notNullable().defaultTo(true)
    table.text('accent_color').notNullable().defaultTo('#863bff')
    table.check("locale in ('en', 'fi')", [], 'bars_locale_check')
    table.check("accent_color ~ '^#[0-9a-fA-F]{6}$'", [], 'bars_accent_color_check')
  })

exports.down = (knex) =>
  knex.schema.alterTable('bars', (table) => {
    table.dropChecks(['bars_locale_check', 'bars_accent_color_check'])
    table.dropColumns('locale', 'clock_24h', 'accent_color')
  })

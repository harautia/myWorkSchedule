// Data deletion (spec DATA-02-04, phase 4).
//
// - bars.scheduled_deletion_at: deleting a bar is scheduled 30 days ahead and
//   can be undone until then; deletion_requested_by is who asked.
// - employees.anonymised_at: a person's data was erased on request (GDPR).
//   Their name is replaced, and their shifts stay so the bar's history is
//   complete.
exports.up = async (knex) => {
  await knex.schema.alterTable('bars', (table) => {
    table.timestamp('scheduled_deletion_at', { useTz: true })
    table.integer('deletion_requested_by').references('id').inTable('users').onDelete('SET NULL')
  })
  await knex.schema.alterTable('employees', (table) => {
    table.timestamp('anonymised_at', { useTz: true })
  })
}

exports.down = async (knex) => {
  await knex.schema.alterTable('employees', (table) => {
    table.dropColumn('anonymised_at')
  })
  await knex.schema.alterTable('bars', (table) => {
    table.dropColumn('deletion_requested_by')
    table.dropColumn('scheduled_deletion_at')
  })
}

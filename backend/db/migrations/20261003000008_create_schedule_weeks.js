// Planning and locked weeks. Managers plan a week, then lock it; locking
// copies the week's shifts and day orders into a snapshot that employees see.
// Unlocking lets managers edit again while employees keep seeing the snapshot.
// A week without a row is in planning and has never been locked.
//
// Existing weeks with shifts are locked, so employees keep seeing what they
// saw before this migration.

// Same rule as utils/weeks.js, copied so this migration never changes.
const WEEK_OF_SHIFT = `date_trunc('week',
  (shifts.start AT TIME ZONE bars.timezone)
  - CASE WHEN bars.closes_at < bars.opens_at THEN bars.closes_at - time '00:00' ELSE interval '0' END
)::date`

exports.up = async (knex) => {
  await knex.schema.createTable('schedule_weeks', (table) => {
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.date('week_start').notNullable()
    table.text('status').notNullable()
    table.timestamp('locked_at', { useTz: true })
    table.integer('locked_by').references('id').inTable('users').onDelete('SET NULL')
    table.jsonb('published_day_orders').notNullable().defaultTo('{}')
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.primary(['bar_id', 'week_start'])
    table.check("status in ('planning', 'locked')")
  })

  // shift_id is the live shift's id, used as the id employees see. No foreign
  // key: the live shift may be changed or deleted while the week is unlocked.
  await knex.schema.createTable('published_shifts', (table) => {
    table.integer('bar_id').notNullable().references('id').inTable('bars').onDelete('CASCADE')
    table.date('week_start').notNullable()
    table.integer('shift_id').notNullable()
    table.integer('employee_id').notNullable().references('id').inTable('employees').onDelete('CASCADE')
    table.timestamp('start', { useTz: true }).notNullable()
    table.timestamp('end', { useTz: true }).notNullable()
    table.primary(['bar_id', 'shift_id'])
    table.index(['bar_id', 'start'])
  })

  await knex.raw(`
    INSERT INTO schedule_weeks (bar_id, week_start, status, locked_at)
    SELECT DISTINCT shifts.bar_id, ${WEEK_OF_SHIFT}, 'locked', now()
    FROM shifts JOIN bars ON bars.id = shifts.bar_id
  `)
  await knex.raw(`
    INSERT INTO published_shifts (bar_id, week_start, shift_id, employee_id, start, "end")
    SELECT shifts.bar_id, ${WEEK_OF_SHIFT}, shifts.id, shifts.employee_id, shifts.start, shifts."end"
    FROM shifts JOIN bars ON bars.id = shifts.bar_id
  `)
  await knex.raw(`
    UPDATE schedule_weeks SET published_day_orders = COALESCE((
      SELECT jsonb_object_agg(day_orders.day::text, day_orders.employee_ids)
      FROM day_orders
      WHERE day_orders.bar_id = schedule_weeks.bar_id
        AND day_orders.day >= schedule_weeks.week_start
        AND day_orders.day < schedule_weeks.week_start + 7
    ), '{}'::jsonb)
  `)
}

exports.down = async (knex) => {
  await knex.schema.dropTable('published_shifts')
  await knex.schema.dropTable('schedule_weeks')
}

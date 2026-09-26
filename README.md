# myWorkSchedule

Work shift schedule for an imaginary bar. Sibling project to
[myBarInventory](https://github.com/harautia/myBarInventory) — same stack:
React (Vite) frontend, Node.js/Express backend and PostgreSQL.

## Status

- **Step 1 (done):** frontend calendar with week and month views, using mock data.
- **Step 2 (done):** Express + Knex + PostgreSQL backend; the frontend reads and saves through the API.
- **Next:** use the bar's opening hours from `GET /api/bar` in the frontend (still constants in `src/utils/dates.js`), then login.

## Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
npm test
npm run lint
```

- Week starts on Monday, 24h times.
- The bar is open 10:00–04:00, so the week view spans 10:00 → 04:00 and a shift
  that crosses midnight (e.g. 18–02) is shown in the column of the day it starts.
- Shifts are shown side by side in employee (legend) order, not by start time. The order can be
  changed per day by dragging a shift left/right inside its day.
- In the week view, drag a shift to move it (up/down = time, into another column = day,
  left/right = position in the day), or drag its bottom edge to
  change the end time. Snaps to 15 min and stays within opening hours. Changes are saved to the backend.
- Click an employee in the legend to hide/show their shifts; click a date in the month view to open that week.
- `src/services/shifts.js` is the only file that talks to the backend.

### Data shape

```js
employee = { id, name, role: 'manager' | 'waiter', color }
shift    = { id, employeeId, start, end } // ISO timestamps
```

## Backend

```bash
cd backend
npm install
cp .env.example .env         # then edit the database URLs
createdb myworkschedule && createdb myworkschedule_test
npm run migrate && npm run migrate:test
npm run seed                 # one bar, 7 employees, 6 weeks of shifts
npm run dev                  # http://localhost:3003 (the Vite dev server proxies /api here)
npm test
npm run lint
```

### Multiple bars

Built to serve several bars (tenants) from day one:

- Tables `employees`, `shifts` and `day_orders` all have a `bar_id` referencing `bars`.
- `utils/tenant.js` sets `request.barId` for every `/api` request. Every model function takes
  `barId` first and filters by it. A bar id is never taken from the URL or body.
- For now every request acts on bar 1 (`DEFAULT_BAR_ID`). When login is added, `resolveBar`
  reads the bar from the session token instead, and nothing else changes.
- Opening hours and timezone are stored per bar (`GET /api/bar`).

### API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/bar` | name, timezone, opensAt, closesAt |
| GET | `/api/employees` | legend order |
| GET | `/api/shifts?from=ISO&to=ISO` | shifts starting in [from, to) |
| POST | `/api/shifts` | `{ employeeId, start, end }` |
| PUT | `/api/shifts/:id` | any of `employeeId`, `start`, `end` |
| DELETE | `/api/shifts/:id` | |
| GET | `/api/day-orders` | `{ 'yyyy-MM-dd': [employeeId, ...] }`, optional `from`/`to` dates |
| PUT | `/api/day-orders/:day` | `{ order: [employeeId, ...] }` |

# myWorkSchedule

Work shift schedule for an imaginary bar. Sibling project to
[myBarInventory](https://github.com/harautia/myBarInventory) — same stack:
React (Vite) frontend, Node.js/Express backend and PostgreSQL.

## Status

- **Step 1 (done):** frontend calendar with week and month views, using mock data.
- **Step 2 (done):** Express + Knex + PostgreSQL backend; the frontend reads and saves through the API.
- **Step 3 (done):** login and user groups (`adminGroup`, `managerGroup`, `employeeGroup`) with a page per group.
- **Next:** use the bar's opening hours from `GET /api/bar` in the frontend (still constants in `src/utils/dates.js`).

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
npm run seed                 # two bars, employees, 6 weeks of shifts, dev accounts
npm run dev                  # http://localhost:3003 (the Vite dev server proxies /api here)
npm test
npm run lint
```

Log in with one of the seeded development accounts (password `secret` for all of them):

| Username | Group | Bar | Sees |
| --- | --- | --- | --- |
| `admin` | adminGroup | none | **Bars**: every bar using the service |
| `anna` | managerGroup | Imaginary Bar | **Schedule** (can edit) and **Employees** |
| `mikko`, `liisa` | employeeGroup | Imaginary Bar | **Schedule**, read-only |
| `laura` | managerGroup | Harbour Pub | same as anna, for Harbour Pub |
| `ville` | employeeGroup | Harbour Pub | same as mikko, for Harbour Pub |

`.env` also needs `SESSION_SECRET` (a long random string), see `.env.example`.

### Users and groups

- `users` holds login accounts (password hashed with scrypt). `bar_id` is the user's bar
  (null for admins). `employee_id` can optionally link the account to a person on the schedule.
- `user_groups` maps users to groups. A user can be in several groups, and gets the pages of all of them.
- Login sets an httpOnly cookie with a JWT that only holds the user id. `requireAuth` loads the user and
  groups from the database on every request, so group changes take effect immediately.
- `requireGroup(...)` guards routes. The frontend (`src/utils/access.js`) only decides which pages to show;
  the backend enforces the same rules.

| Group | Can |
| --- | --- |
| adminGroup | list all bars (`/api/admin/*`); has no bar of its own |
| managerGroup | view and change own bar's schedule, see own bar's employees with their accounts |
| employeeGroup | view own bar's schedule |

### Multiple bars

- Tables `employees`, `shifts`, `day_orders` and `users` all have a `bar_id` referencing `bars`.
- `utils/tenant.js` sets `request.barId` from the logged-in user. Every model function takes
  `barId` first and filters by it. A bar id is never taken from the URL or body.
- Opening hours and timezone are stored per bar (`GET /api/bar`).

### API

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/api/login` | anyone | `{ username, password }`, returns the user and sets the session cookie |
| POST | `/api/logout` | anyone | |
| GET | `/api/me` | logged in | `{ id, username, name, groups, barId, barName, employeeId }` |
| GET | `/api/admin/bars` | admin | all bars with employee and user counts |
| GET | `/api/bar` | manager, employee | name, timezone, opensAt, closesAt |
| GET | `/api/employees` | manager, employee | legend order |
| GET | `/api/employees/details` | manager | employees with their login account |
| GET | `/api/shifts?from=ISO&to=ISO` | manager, employee | shifts starting in [from, to) |
| POST | `/api/shifts` | manager | `{ employeeId, start, end }` |
| PUT | `/api/shifts/:id` | manager | any of `employeeId`, `start`, `end` |
| DELETE | `/api/shifts/:id` | manager | |
| GET | `/api/day-orders` | manager, employee | `{ 'yyyy-MM-dd': [employeeId, ...] }`, optional `from`/`to` dates |
| PUT | `/api/day-orders/:day` | manager | `{ order: [employeeId, ...] }` |

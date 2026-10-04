# myWorkSchedule

Work shift schedule for an imaginary bar. Sibling project to
[myBarInventory](https://github.com/harautia/myBarInventory) — same stack:
React (Vite) frontend, Node.js/Express backend and PostgreSQL.

The project is going to be **open source (AGPL-3.0)**: anyone can run their own copy, or use the
hosted service run by the author. Both have the same features. The plan for getting there is in
[docs/SPECIFICATION.md](docs/SPECIFICATION.md).

## Status

- **Step 1 (done):** frontend calendar with week and month views, using mock data.
- **Step 2 (done):** Express + Knex + PostgreSQL backend; the frontend reads and saves through the API.
- **Step 3 (done):** login and user groups (`adminGroup`, `managerGroup`, `employeeGroup`) with a page per group.
- **Step 4 (done):** admin operations: create a bar with its first manager, edit bar settings,
  add/remove managers, set a manager's name or new password (password recovery), delete a bar.
  A manager created by the admin is also put on the schedule (employee with role `manager`, linked to the account).
- **Step 5 (done):** manager operations on the Employees page: add an employee (on the schedule as a
  waiter, with an `employeeGroup` login in the manager's own bar), rename, set a new password, remove
  (deletes the login, the employee and all their shifts). Managers' accounts stay admin-only.
  On the schedule, managers add shifts (click an empty spot in the week view, or "Add shift") and delete them (×).
- **Step 6 (done):** planning and locked weeks. Each bar week (Mon–Sun bar days) is either in
  *planning* (managers can change it) or *locked* (nobody can). Locking publishes a snapshot of the
  week to employees; after unlocking, employees keep seeing that snapshot until the week is locked again.
  Weeks never locked show employees no shifts ("not published yet"). The migration locked every week that
  already had shifts; new weeks start in planning.
- **Step 7 (done):** several bar days can be chosen when adding a shift (one request, all or nothing).
- **Step 8 (done):** mobile + PWA (phase A). On phones the app has a "My shifts" list, which is the
  default for employees. The week view shows one day at a time with a day strip, and tables become cards.
  On touch screens, managers tap a shift to edit or delete it instead of dragging. The app can be installed
  as a PWA, and the last loaded schedule is shown offline. Phase B ideas: web push when a week is locked,
  and a personal iCal feed.
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
- Managers add a shift by clicking an empty spot in a day (or with "Add shift"), and delete one with its × button.
  In the new-shift form several bar days can be chosen in a small calendar; the same shift is then added on
  every chosen day in one request (days in locked weeks can't be chosen).
- Above the week view, managers see the week's state with **Lock week** / **Unlock week**. Shifts of a
  locked week can't be added, dragged or deleted. The month view marks locked weeks with 🔒.
- Click an employee in the legend to hide/show their shifts; click a date in the month view to open that week.
- **Phones (≤ 640px):**
  - **My shifts** (toolbar) lists your own shifts for 4 weeks, and it is the default view for employees.
  - The week view shows one day, picked from a Mon–Sun strip.
  - The new and edit shift forms open as a sheet from the bottom.
- **Touch screens:** shifts aren't draggable, so the page scrolls normally. Managers tap a shift to change
  its employee or times, or to delete it.
- **PWA:**
  - `vite-plugin-pwa` builds a manifest (icons in `public/icons/`) and a service worker.
  - The service worker precaches the app and caches bar data GETs, network first, so the last loaded
    schedule works offline. The cache is cleared on login and logout.
  - It only works in a production build (`npm run build`), served over HTTPS or on `localhost`, not in `npm run dev`.
- The code talking to the backend is in `src/services/`.

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
| `admin` | adminGroup | none | **Bars**: every bar using the service; open one to manage it |
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
- Every session token carries the user's `session_version`. Setting a new password bumps it, so old
  sessions stop working (an admin resetting a lost password also logs out whoever has the old one).
- `requireGroup(...)` guards routes. The frontend (`src/utils/access.js`) only decides which pages to show;
  the backend enforces the same rules.

| Group | Can |
| --- | --- |
| adminGroup | list all bars and their users, create/edit/delete bars, add/edit/remove managers (`/api/admin/*`); has no bar of its own |
| managerGroup | view and change own bar's schedule; add, rename, reset the password of and remove own bar's employees (not managers) |
| employeeGroup | view own bar's schedule |

### Multiple bars

- Tables `employees`, `shifts`, `day_orders` and `users` all have a `bar_id` referencing `bars`.
- `utils/tenant.js` sets `request.barId` from the logged-in user. Every model function takes
  `barId` first and filters by it. A bar id is never taken from the URL or body.
- Opening hours and timezone are stored per bar (`GET /api/bar`).
- Deleting a bar (admin) permanently deletes all its data: employees, shifts, day orders, and every
  manager's and employee's login account with their group memberships (`ON DELETE CASCADE` from `bars`).
  This is the current solution; details such as keeping an export or a grace period are still to be decided.

### API

| Method | Path | Who | Notes |
| --- | --- | --- | --- |
| POST | `/api/login` | anyone | `{ username, password }`, returns the user and sets the session cookie |
| POST | `/api/logout` | anyone | |
| GET | `/api/me` | logged in | `{ id, username, name, groups, barId, barName, employeeId }` |
| GET | `/api/admin/bars` | admin | all bars with employee and user counts |
| POST | `/api/admin/bars` | admin | `{ bar: { name, timezone, opensAt, closesAt }, manager: { username, name, password } }` |
| GET | `/api/admin/bars/:barId` | admin | `{ bar, users }`: every account in the bar with groups and linked employee |
| PUT | `/api/admin/bars/:barId` | admin | `{ name, timezone, opensAt, closesAt }` |
| DELETE | `/api/admin/bars/:barId` | admin | deletes the bar with its employees, shifts, day orders and accounts |
| POST | `/api/admin/bars/:barId/managers` | admin | `{ username, name, password }`; also adds them to the schedule as a manager |
| PUT | `/api/admin/bars/:barId/managers/:userId` | admin | `{ name?, password? }`; a new name also renames them on the schedule, a new password ends old sessions |
| DELETE | `/api/admin/bars/:barId/managers/:userId` | admin | deletes the account (their schedule entry and shifts stay); refused for the bar's last manager |
| GET | `/api/bar` | manager, employee | name, timezone, opensAt, closesAt |
| GET | `/api/employees` | manager, employee | legend order |
| GET | `/api/employees/details` | manager | employees with their login account and shift count |
| POST | `/api/employees` | manager | `{ username, name, password }`; adds a waiter with an employeeGroup login to the manager's bar |
| PUT | `/api/employees/:id` | manager | `{ name?, password? }`; renames on the schedule and the account, a new password ends old sessions; not for managers |
| DELETE | `/api/employees/:id` | manager | deletes the login account, the employee and all their shifts; not for managers |
| GET | `/api/shifts?from=ISO&to=ISO` | manager, employee | shifts starting in [from, to); managers get live shifts, employees the locked version |
| GET | `/api/shifts/mine?from=ISO&to=ISO` | manager, employee | the same, but only the logged-in user's own shifts |
| POST | `/api/shifts` | manager | `{ employeeId, start, end }` |
| POST | `/api/shifts/batch` | manager | `{ shifts: [{ employeeId, start, end }, ...] }` (1–62); all or nothing |
| PUT | `/api/shifts/:id` | manager | any of `employeeId`, `start`, `end` |
| DELETE | `/api/shifts/:id` | manager | |
| GET | `/api/day-orders` | manager, employee | `{ 'yyyy-MM-dd': [employeeId, ...] }`, optional `from`/`to` dates; employees get the locked version |
| PUT | `/api/day-orders/:day` | manager | `{ order: [employeeId, ...] }` |
| GET | `/api/schedule-weeks?from=yyyy-MM-dd&to=yyyy-MM-dd` | manager, employee | `{ monday: { status, lockedAt, lockedBy, published } }` for weeks overlapping the range |
| POST | `/api/schedule-weeks/:monday/lock` | manager | publishes the week's shifts and day orders to employees and stops changes |
| POST | `/api/schedule-weeks/:monday/unlock` | manager | allows changes again; employees keep the last locked version |

Changing a shift or day order in a locked week answers 409 (also moving a shift into or out of one).
The week of a shift is the Monday of its bar day in the bar's timezone (before `closes_at` counts as the
previous day), see `backend/utils/weeks.js`. Removing an employee also removes their shifts from locked weeks.

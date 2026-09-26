# myWorkSchedule

Work shift schedule for an imaginary bar. Sibling project to
[myBarInventory](https://github.com/harautia/myBarInventory) — same stack:
React (Vite) frontend, Node.js/Express backend and PostgreSQL (backend coming next).

## Status

- **Step 1 (done):** frontend calendar with week and month views, using mock data.
- **Step 2:** Express + Knex + PostgreSQL backend (`employees`, `shifts` tables), replace mock service with API calls.

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
  change the end time. Snaps to 15 min and stays within opening hours. Changes are kept
  in memory only until the backend exists.
- Click an employee in the legend to hide/show their shifts; click a date in the month view to open that week.
- Mock data lives in `src/data/mockData.js`; `src/services/shifts.js` is the only place
  that needs to change when the backend exists.

### Data shape

```js
employee = { id, name, role: 'manager' | 'waiter', color }
shift    = { id, employeeId, start, end } // ISO timestamps
```

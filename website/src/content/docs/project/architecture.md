---
title: Architecture
description: How myWorkSchedule is built.
---

myWorkSchedule is one Node.js server with a PostgreSQL database. The server provides a
JSON API and serves the web app, which is a React progressive web app (PWA).

```
Browser / phone (React PWA) ──/api──▶ Express server ──▶ PostgreSQL
```

## Repository layout

| Folder | Contents |
|---|---|
| `backend/` | Express 5 API, Knex migrations and models, tests (`node:test` + supertest) |
| `frontend/` | React 19 + Vite app, installable as a PWA; tests with Vitest |
| `website/` | This website (Astro + Starlight) |
| `docs/` | The product specification |
| `Dockerfile`, `docker-compose.yml` | The self-hosting image and setup |

## Key ideas

- **Several bars in one installation.** Every bar's data carries a `bar_id`, and the
  server always takes the bar from the logged-in user, never from the request. Tests
  check that one bar can't see or change another bar's data.
- **Roles.** Admins manage bars and their managers; managers plan their own bar's
  schedule and staff; employees see the published schedule.
- **Bar days.** A bar is open past midnight, so a shift belongs to the day it starts.
  Weeks run Monday to Sunday in the bar's timezone.
- **Planning and locked weeks.** Locking a week saves a snapshot that employees see.
  Managers can unlock to make changes without employees seeing them before the week is
  locked again.
- **Settings from the environment.** Everything that differs between installations is an
  environment variable; see [configuration](../../self-hosting/configuration/).

The [specification](https://github.com/harautia/myWorkSchedule/blob/master/docs/SPECIFICATION.md)
describes where the project is heading.

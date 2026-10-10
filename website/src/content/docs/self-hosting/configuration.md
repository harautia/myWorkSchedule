---
title: Configuration
description: Every setting of myWorkSchedule, set with environment variables.
---

All settings are environment variables. With Docker Compose they go in the `.env` file
next to `docker-compose.yml`; after changing it, run `docker compose up -d` to apply.
The app refuses to start, with a clear message in `docker compose logs app`, if a
required setting is missing or unsafe.

## Required

| Variable | What it is |
|---|---|
| `POSTGRES_PASSWORD` | Password of the bundled PostgreSQL database (Docker Compose only). A long random string: `openssl rand -hex 24`. |
| `SESSION_SECRET` | Signs login sessions. At least 32 random characters: `openssl rand -hex 32`. Changing it logs everyone out. |
| `DATABASE_URL` | PostgreSQL connection, e.g. `postgres://user:password@host:5432/myworkschedule`. Docker Compose sets this for you from `POSTGRES_PASSWORD`; set it yourself only when using your own database. |

## Email

Optional. Used for invitations and "forgot password". Any SMTP server works: your email
provider's, or a sending service such as Postmark, Mailgun, Brevo or Amazon SES.

| Variable | Default | What it is |
|---|---|---|
| `SMTP_URL` | empty | The SMTP server, with login, as a URL: `smtps://user:password@smtp.example.com:465` (SSL) or `smtp://user:password@smtp.example.com:587` (STARTTLS). Special characters in the password must be URL-encoded. |
| `EMAIL_FROM` | empty | Sender of the emails, e.g. `myWorkSchedule <schedule@yourbar.com>`. Required with `SMTP_URL`. Use an address your SMTP service is allowed to send from. |
| `APP_URL` | the address of the request | Public address of the app, used in the links in emails, e.g. `https://schedule.yourbar.com`. Set it when the app is behind a reverse proxy. |

**Without email:** when a manager adds an employee, the app shows the invitation link to
copy and send by other means (e.g. a text message). "Forgot password?" isn't shown; a
manager (for employees) or the admin (for managers) sets a new password instead.

## Shown in the app

These appear in the footer of every page, including the login page.

| Variable | Default | What it is |
|---|---|---|
| `APP_OPERATOR_NAME` | empty | Who runs this copy, e.g. your bar or company. |
| `APP_CONTACT_EMAIL` | empty | Where users can contact you. |
| `APP_PRIVACY_URL` | empty | Link to your privacy policy. |
| `APP_SOURCE_URL` | the official repository | Link to the source code of the version you run. **If you change the code and others use your copy, point this to your changed source**: the AGPL licence requires that they can get it. |

## Server

| Variable | Default | What it is |
|---|---|---|
| `MYWORKSCHEDULE_VERSION` | `latest` | Image version Docker Compose runs, e.g. `0.1.0`. Pin a version to upgrade only when you choose. |
| `APP_BIND` | `127.0.0.1` | Address the app listens on, on the server (Docker Compose). Keep `127.0.0.1` when the reverse proxy runs on the same server. |
| `APP_PORT` | `3003` | Port on the server (Docker Compose). |
| `PORT` | `3003` | Port inside the container, or of the Node.js process when not using Docker. |
| `MIGRATE_ON_START` | `true` | Update the database tables when the app starts. Turn off only if you run migrations separately (`npm run migrate`). |
| `COOKIE_SECURE` | `true` in production | Send the login cookie over HTTPS only. Set `false` only for testing without HTTPS. |
| `DATABASE_SSL` | `false` | Set `true` when your database requires SSL, typically a managed database reached over the internet. |
| `DEPLOYMENT_MODE` | `self-hosted` | `self-hosted` for your own copy. `hosted` is for the official hosted service and turns on its billing features (in a later version). |

## Sign-up

By default only the admin creates bars. With sign-up on, the login page also offers
**Create an account**, where anyone can create a bar of their own and become its owner.
The website or a link can open the form directly at `https://your-app/?signup`.

| Variable | Default | What it is |
|---|---|---|
| `ALLOW_SIGNUP` | `false` (self-hosted) | `true` turns sign-up on. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | empty | Optional [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) bot check on the sign-up form. Set both or neither. |

Sign-ups are limited to five an hour from one address. With email configured, a new
owner gets a link to confirm their email address and can invite staff once it's
confirmed. Without email, the address is taken as given, so anyone could sign up with
someone else's address: turn sign-up on only with email configured.

## Running without Docker

The app is a Node.js 22 server (`backend/`) that serves the built frontend
(`frontend/dist`, copied to `backend/dist`). Set the variables above in the environment
or in `backend/.env`, then run `NODE_ENV=production node index.js` in `backend/`.
The [Dockerfile](https://github.com/harautia/myWorkSchedule/blob/master/Dockerfile) shows
the exact build steps.

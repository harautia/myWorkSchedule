---
title: Install with Docker
description: Run your own copy of myWorkSchedule with Docker Compose in about 30 minutes.
---

This guide gets your own copy of myWorkSchedule running on a server with Docker. You need
basic experience with the command line and a server you can reach over the internet.

## What you need

- A Linux server with at least **1 GB of memory**, for example a small cloud server.
  Intel/AMD and ARM both work.
- [Docker](https://docs.docker.com/engine/install/) with the Compose plugin
  (`docker compose version` works).
- A **domain name** pointing to the server, for HTTPS, e.g. `schedule.yourbar.com`.

You don't need an email service: in this version, managers set their employees'
passwords.

## 1. Get the files

You only need two files from the repository: `docker-compose.yml` and `.env.example`.

```bash
mkdir myworkschedule && cd myworkschedule
curl -fsSLO https://raw.githubusercontent.com/harautia/myWorkSchedule/master/docker-compose.yml
curl -fsSL https://raw.githubusercontent.com/harautia/myWorkSchedule/master/.env.example -o .env
```

## 2. Fill in the settings

Open `.env` and fill in at least the two required values. Generate each with
`openssl rand -hex 32`:

```ini
POSTGRES_PASSWORD=<a long random string>
SESSION_SECRET=<another long random string>
```

The optional `APP_*` values are shown in the app footer: who runs this copy, a contact
address and your privacy policy. All settings are explained in the
[configuration reference](../configuration/).

## 3. Start it

```bash
docker compose up -d
```

This downloads the app image and PostgreSQL, creates the database tables and starts the
app on `127.0.0.1:3003`. Check that it's healthy:

```bash
curl http://127.0.0.1:3003/api/health
# {"status":"ok","version":"0.1.0"}
```

## 4. Create the first admin

```bash
docker compose exec app npm run create-admin -- --username admin --name "Your Name"
```

You're asked for the password twice; it isn't shown while you type. The admin manages
the installation: bars and their managers.

## 5. Add HTTPS with a reverse proxy

The app only listens on the server itself; a reverse proxy in front of it handles HTTPS.
With [Caddy](https://caddyserver.com/docs/install), which gets and renews certificates
automatically, the whole configuration (`/etc/caddy/Caddyfile`) is:

```
schedule.yourbar.com {
    reverse_proxy 127.0.0.1:3003
}
```

Reload Caddy (`sudo systemctl reload caddy`) and open `https://schedule.yourbar.com`.
Nginx or Traefik work just as well; forward everything to `127.0.0.1:3003`.

:::caution[HTTPS is required]
For security, login sessions only work over HTTPS. To try the app quickly on your own
computer without HTTPS, set `COOKIE_SECURE=false` in `.env`, but never on a real
installation.
:::

## 6. Set up your bar

1. Log in as the admin and open **Bars → New bar**. Enter the bar's name, timezone and
   opening hours, and its first manager's username and password.
2. Give the manager their login. The manager adds employees on the **Employees** page
   and plans shifts on the **Schedule** page.
3. When a week is ready, the manager clicks **Lock week**, and employees can see it.

Next: set up [backups](../upgrading/#backups). Your schedule data lives in the
database volume on this server only.

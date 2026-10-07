---
title: Upgrades and backups
description: Keep your myWorkSchedule installation up to date and its data safe.
---

## Upgrading

Before upgrading, read the [changelog](https://github.com/harautia/myWorkSchedule/blob/master/CHANGELOG.md).
Anything you need to do yourself is listed under **Upgrading** for each version. Until
version 1.0, a new minor version (for example 0.2) may contain such changes.

1. [Make a backup](#backups).
2. If you pinned a version in `.env`, change `MYWORKSCHEDULE_VERSION` to the new one.
3. Download the new image and restart:

   ```bash
   docker compose pull
   docker compose up -d
   ```

The database tables are updated automatically when the app starts. Check the result with
`curl http://127.0.0.1:3003/api/health`, which shows the running version, and
`docker compose logs app` if something looks wrong.

To be told about new versions, choose **Watch → Custom → Releases** on the
[GitHub repository](https://github.com/harautia/myWorkSchedule). Security fixes are only
made to the latest version, so keep up to date.

## Backups

All schedule data lives in the PostgreSQL database. Back it up regularly, and keep copies
somewhere other than the server.

**Make a backup:**

```bash
docker compose exec -T db pg_dump -U myworkschedule myworkschedule | gzip > backup-$(date +%F).sql.gz
```

**Every night**, with cron (`crontab -e`), keeping the last 30 days:

```cron
0 3 * * * cd /path/to/myworkschedule && docker compose exec -T db pg_dump -U myworkschedule myworkschedule | gzip > backups/backup-$(date +\%F).sql.gz && find backups -name '*.sql.gz' -mtime +30 -delete
```

**Restore a backup** into an empty database. This replaces all current data:

```bash
docker compose down
docker volume rm myworkschedule_db-data    # the volume name: docker volume ls
docker compose up -d db
gunzip -c backup-2026-10-07.sql.gz | docker compose exec -T db psql -U myworkschedule -d myworkschedule
docker compose up -d
```

Test a restore now and then, for example on another computer, so you know your backups
work.

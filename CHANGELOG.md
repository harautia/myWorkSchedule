# Changelog

All notable changes are listed here. The project follows
[semantic versioning](https://semver.org/): until 1.0, minor versions (0.x) may contain
breaking changes, which are always described under **Upgrading**.

## [Unreleased]

### Added
- Bar settings page for managers: name, timezone, opening hours, language, 12/24-hour
  clock and accent colour. Admins set the same when creating or editing a bar.
- `PUT /api/bar` for managers to change their own bar's settings.

### Changed
- The schedule uses the bar's own timezone and opening hours everywhere, instead of
  10:00–04:00 and the viewer's computer time. Times are the bar's local time for
  everyone, wherever they are.

### Upgrading
- A database migration adds the new settings with defaults (English, 24-hour clock, the
  default purple); it runs automatically on start.

## [0.1.0] – unreleased

First public release.

### Added
- Weekly and monthly work schedule for bars, with drag and drop on desktop and
  tap-to-edit on touch screens.
- Planning and locked weeks: employees see only published (locked) weeks.
- Adding the same shift on several days at once.
- Several bars in one installation, with admin, manager and employee roles.
- Managers add, rename and remove employees and reset their passwords.
- "My shifts" list and one-day view for phones; installable as a PWA, and the last loaded
  schedule is shown offline.
- Docker image and `docker-compose.yml` for self-hosting; database migrations run on start.
- `npm run create-admin` to create the first admin of a new installation.
- `GET /api/health` for Docker and monitoring, and `GET /api/app-info` for the app footer.
- Operator details (name, contact email, privacy policy link, source code link) from
  environment variables.

### Upgrading
- New installation: see the self-hosting guide.

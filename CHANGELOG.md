# Changelog

All notable changes are listed here. The project follows
[semantic versioning](https://semver.org/): until 1.0, minor versions (0.x) may contain
breaking changes, which are always described under **Upgrading**.

## [Unreleased]

### Added
- **Organizations and memberships**, the groundwork for sign-up and for chains of bars.
  Every bar belongs to an organization, and a user's bars and roles are kept as
  memberships. Each bar has an **owner** (shown with an Owner badge); when the owner is
  removed, the oldest remaining manager becomes the owner.

### Changed
- `GET /api/me` and the account lists also return `role` (`owner`, `manager` or
  `employee`); `/api/me` also returns `organizationId`.
- Deleting a bar keeps the accounts of people who also belong to another bar.

### Upgrading
- **Back up the database first** (see the upgrade guide). A database migration moves
  every account's bar and group into memberships, gives each bar an organization of its
  own, and makes each bar's oldest manager its owner. It runs automatically on start.
  The `user_groups` table is removed.

## [0.1.0] – 2026-10-10

First public release.

### Added
- Weekly and monthly work schedule for bars, with drag and drop on desktop and
  tap-to-edit on touch screens.
- Planning and locked weeks: employees see only published (locked) weeks.
- Adding the same shift on several days at once.
- Several bars in one installation, with admin, manager and employee roles.
- Managers add, rename and remove employees and reset their passwords.
- Bar settings page for managers: name, timezone, opening hours, language, 12/24-hour
  clock and accent colour. Admins set the same when creating or editing a bar. The
  schedule uses the bar's own timezone and opening hours everywhere: times are the
  bar's local time for everyone, wherever they are.
- The app is available in **English and Finnish**. A bar's language is part of its
  settings; admins and the login page follow the browser's language.
- **Email login, invitations and password reset.** Log in with an email address or a
  username. Managers add employees by name and email; the employee gets an invitation
  and chooses their own password. "Forgot password?" emails a single-use link (valid one
  hour). Email goes through any SMTP server (`SMTP_URL`, `EMAIL_FROM`, `APP_URL`);
  without one, managers get the invitation link to pass on themselves.
- "My shifts" list and one-day view for phones; installable as a PWA, and the last loaded
  schedule is shown offline.
- Docker image and `docker-compose.yml` for self-hosting; database migrations run on start.
- `npm run create-admin` to create the first admin of a new installation.
- `GET /api/health` for Docker and monitoring, and `GET /api/app-info` for the app footer.
- Operator details (name, contact email, privacy policy link, source code link) from
  environment variables.

### Upgrading
- New installation: see the self-hosting guide.

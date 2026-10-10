# Contributing to myWorkSchedule

Thanks for helping! Bug reports, fixes, features, translations and documentation are all
welcome. Please follow the [code of conduct](CODE_OF_CONDUCT.md), and report security
problems privately as described in [SECURITY.md](SECURITY.md).

## Before you start

- **Bugs:** open an issue with steps to reproduce.
- **Features or bigger changes:** open an issue first to agree on the approach, so your
  work fits the project. The [specification](docs/SPECIFICATION.md) describes where the
  project is heading.
- **Small fixes** (typos, docs, obvious bugs) can go straight to a pull request.

## Run it locally

You need Node.js 22 and PostgreSQL. The quickest way to get PostgreSQL is Docker:

```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL with both databases
```

Or create the databases in your own PostgreSQL:
`createdb myworkschedule && createdb myworkschedule_test`.

**Backend** (http://localhost:3003):

```bash
cd backend
npm install
cp .env.example .env     # set DATABASE_URL, TEST_DATABASE_URL and SESSION_SECRET
npm run migrate && npm run migrate:test
npm run seed             # development data: two bars, staff, shifts; password "secret"
npm run dev
```

**Frontend** (http://localhost:5173, sends `/api` to the backend):

```bash
cd frontend
npm install
npm run dev
```

Log in as `admin`, `anna` (manager) or `mikko` (employee), all with the password `secret`
(or with their email, e.g. `anna@example.com`). To try invitation and password reset
links locally, set `APP_URL=http://localhost:5173` in `backend/.env`; without `SMTP_URL`
the app shows invitation links instead of sending them.
The [README](README.md) lists all development accounts and explains the code.

**Website** (http://localhost:4321/myWorkSchedule/): `cd website && npm install && npm run dev`.

## Making changes

- **Tests:** add or update tests with every change: `npm test` in `backend/` and
  `frontend/`. Backend tests use the test database and reset it for every test.
  Frontend tests run in Helsinki time (`npm test` sets `TZ`), so results don't depend on
  your computer's timezone.
- **Lint:** `npm run lint` in `backend/` and `frontend/`.
- **Keep bars apart:** every new endpoint must take the bar from the logged-in user
  (`request.barId`), never from the URL or body, and get a test showing that a user of one
  bar can't reach another bar's data.
- **Style:** match the surrounding code: plain JavaScript, small functions, short comments
  that explain *why*.
- **Settings:** anything that differs between installations is an environment variable,
  documented in `.env.example` and on the website's configuration page.
- **Changelog:** if users or self-hosters notice the change, add a line to
  [CHANGELOG.md](CHANGELOG.md) under the next version.

## Sign off your commits (DCO)

Every commit must be signed off. This certifies that you wrote the change or otherwise
have the right to contribute it under the project's licence, as described in the
[Developer Certificate of Origin](https://developercertificate.org/):

```bash
git commit -s -m "Fix week label in month view"
```

This adds a line like `Signed-off-by: Your Name <you@example.com>` to the commit message,
using your git name and email. Forgot it? `git commit --amend -s` for the last commit, or
`git rebase --signoff master` for all commits in your branch. CI checks every commit in
a pull request.

## Translations

The app's texts are in `frontend/src/i18n/`: `en.json` (English, the reference) and
`fi.json` (Finnish).

- **To improve a translation**, edit the file and open a pull request.
- **To add a language**, copy `en.json`, translate the texts and add the language to
  `LANGUAGE_CODES` in `frontend/src/i18n/index.js` and `LANGUAGES` in
  `frontend/src/utils/forms.js`. The backend also lists the allowed languages
  (`LOCALES` in `backend/utils/validation.js`, plus a check in the database), so a new
  language needs a small migration too.

Keep the `{{placeholders}}` as they are. Texts with a count use i18next's plural forms
(`_one`, `_other`). `npm test` checks that every language has every text, with the same
placeholders.

## Pull requests

1. Fork the repository and create a branch from `master`.
2. Make your change, with tests, and sign off your commits.
3. Open a pull request and fill in the checklist. CI runs lint, tests, a licence check of
   the dependencies, the Docker build and the sign-off check.
4. A maintainer reviews it; small follow-up commits are fine.

By contributing, you agree that your contribution is licensed under the
[GNU Affero General Public License v3 or later](LICENSE), like the rest of the project.

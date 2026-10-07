---
title: Contributing
description: How to run myWorkSchedule locally and send changes.
---

Contributions are welcome: bug reports, fixes, features, translations and documentation.
The full guide, with local setup and code conventions, is
[CONTRIBUTING.md](https://github.com/harautia/myWorkSchedule/blob/master/CONTRIBUTING.md)
in the repository. In short:

1. **Start with an issue** for anything bigger than a small fix, so we can agree on the
   approach first.
2. **Run it locally:** PostgreSQL (or `docker compose -f docker-compose.dev.yml up -d`),
   then `npm install` and `npm run dev` in `backend/` and `frontend/`.
3. **Sign off every commit** with `git commit -s`. It adds a `Signed-off-by` line that
   certifies you have the right to contribute the change
   ([Developer Certificate of Origin](https://developercertificate.org/)).
4. **Open a pull request.** CI runs the linters, all tests, a dependency licence check and
   the sign-off check.

Please follow the [code of conduct](https://github.com/harautia/myWorkSchedule/blob/master/CODE_OF_CONDUCT.md).
Security problems are reported privately; see
[SECURITY.md](https://github.com/harautia/myWorkSchedule/blob/master/SECURITY.md).

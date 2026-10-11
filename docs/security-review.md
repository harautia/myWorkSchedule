# Security review

Phase 4 of the roadmap (spec §13), done on 11.10.2026 before taking real customers. It
goes through the app with the [OWASP Top 10 (2021)](https://owasp.org/Top10/) in mind,
and lists what was fixed and what is left. Repeat it before major releases; report
vulnerabilities as described in `SECURITY.md`.

**Scope:** the backend (`backend/`), the frontend (`frontend/`), the Docker image and CI.
The hosting of the official service (servers, backups, monitoring) isn't built yet and is
reviewed when it is.

## Fixed in this review

| # | Finding | Fix |
|---|---|---|
| 1 | No Content Security Policy (SEC-03). | A strict policy: only the app's own files, plus Cloudflare Turnstile on the sign-up form. No inline scripts, no `eval`, no framing (`frame-ancestors 'none'`). Tested in `tests/security.test.js`. |
| 2 | nodemailer 7 had several high-severity advisories (header injection, SSRF). | Upgraded to nodemailer 10. |
| 3 | Vitest 3 (a test tool) pulled in packages with critical and high advisories. | Upgraded to Vitest 5; all tests pass. |
| 4 | Names could contain line breaks, which can end up in email subjects and exported files. | Names (people, bars) refuse control characters. |
| 5 | The request log wrote every request body, with names and emails, also in production; reset and verification tokens were logged too. | Bodies are only logged outside production, and passwords and tokens never. |
| 6 | Sending invitations had no rate limit (SEC-02). | At most 50 invitations an hour from one address. |
| 7 | Session and support tokens were checked without fixing the signing algorithm. | Only HS256 is accepted. |
| 8 | Nothing checked dependencies for known vulnerabilities (SEC-05). | CI fails on high or critical advisories in runtime dependencies; Dependabot opens update pull requests weekly. |

## Reviewed, no change needed

**A01 Broken access control**
- Every bar route takes the bar from the logged-in user (`utils/tenant.js`), never from the
  request; tests check that one bar can't see or change another's data.
- Roles are checked on the server for every write (`requireGroup`); the frontend only hides
  what the server would refuse anyway. Billing, exports and deleting the bar are for the
  owner only.
- Support mode is read-only on the server, needs a reason, lasts an hour, and is written
  to the audit log. The support cookie only works with the same admin's session.
- The hosted service's subscription status is enforced on the server (402), and only
  Stripe's signed webhooks change it.

**A02 Cryptographic failures**
- Passwords: scrypt with a random salt per password, compared in constant time.
- Invitation, reset and verification links: 32 random bytes; only a SHA-256 hash is
  stored, so a copy of the database can't be used to take over accounts.
- The session cookie is `HttpOnly`, `SameSite=Lax`, and `Secure` in production. The app
  refuses to start in production with a short or placeholder `SESSION_SECRET`.

**A03 Injection**
- All database queries go through Knex with bound parameters. The few raw SQL pieces only
  insert numbers defined in the code. Searches escape `%` and `_`.
- React escapes everything it shows; emails are plain text.
- The shifts CSV defuses values that a spreadsheet would run as formulas.

**A04 Insecure design**
- Rate limits: login (10 failed tries per 15 minutes), sign-up (5 an hour), email links and
  password reset (20 per 15 minutes), invitations (50 an hour).
- Sign-up can be protected by Cloudflare Turnstile; new owners must confirm their email
  before sending invitations.
- Deleting a bar is scheduled 30 days ahead and can be undone; erasing a person is
  refused for a bar's last manager.

**A05 Security misconfiguration**
- helmet's headers, `X-Powered-By` removed. Unsafe production settings stop the app at
  start (`config.problems()`). Errors don't reveal stack traces in production.

**A07 Identification and authentication failures**
- A password change or reset ends all the account's sessions (`session_version`). Login
  takes about the same time whether or not the account exists. Reset links work once,
  for an hour.

**A08 Software and data integrity failures**
- Stripe webhooks are checked against Stripe's signature and handled only once.
- Releases are built by CI from version tags; commits need a DCO sign-off in pull requests.

**A09 Security logging and monitoring**
- The audit log keeps support access, subscription changes, exports, bar deletions and
  erasures, without personal data for erasures.

**A10 Server-side request forgery**
- The only outgoing requests go to fixed addresses (Stripe, Cloudflare Turnstile, the
  configured SMTP server).

**Cross-site request forgery:** the session cookie is `SameSite=Lax` and the API only
accepts JSON, so other sites can't send authenticated requests.

## Accepted, or left for later

| Item | Why | When |
|---|---|---|
| Postgres row-level security as a second safeguard between bars (SEC-01). | A big change; the application-level checks are tested. | After launch (decided 11.10.2026). |
| Logging out only removes the cookie; a copied session token works until it expires (7 days) or the password changes. | Low risk with an `HttpOnly` cookie. Fix with a session table or by bumping `session_version` on logout. | Later (AUTH-06, active sessions). |
| scrypt runs with Node's default cost (N = 16384), below OWASP's current recommendation (N = 131072). | Changing it needs the cost stored in each hash so old passwords still work. | Before launch if time allows. |
| Failed logins aren't written to the audit log. | The rate limit stops guessing; logging needs care not to store attempted passwords or flood the log. | With monitoring (Sentry), phases 2–3 of hosting. |
| Two-factor authentication (AUTH-05; required for platform admins). | Not built yet. | **Before launch for the platform admin.** |
| The website's build tool (Starlight) depends on a PostCSS version with a moderate advisory (slow parsing of crafted CSS). | Only our own CSS is built, and the site is static. The suggested fix downgrades Starlight. | When Starlight updates; Dependabot will offer it. |
| The CSP hasn't been tried in every browser. | Tested by headers; the built app has no inline scripts. | Check the browser console once after deploying (sign-up with Turnstile, Stripe redirect, PWA install). |

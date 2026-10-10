# myWorkSchedule as a service: product specification

| | |
|---|---|
| **Status** | Draft 0.6, all decisions, targets and pricing set |
| **Owner** | Hannu Rautiainen |
| **Last updated** | 2026-10-04 |
| **Codebase** | `myWorkSchedule/` (React + Vite frontend, Express + Knex + PostgreSQL backend) |
| **Licence** | Open source, AGPL-3.0 (decided; see D10) |

This document describes how myWorkSchedule grows from one installation into an **open-source work schedule application that anyone can run**. Bars can either **host it themselves** or **subscribe to the hosted service** run by the author. Both use the same code and have the same features; on the hosted service a bar pays for convenience: hosting, backups, updates, email delivery and support.

The document has three uses:

1. It records the decisions that have to be made before building. Open decisions and targets are marked **🟡**, and decisions already made are marked **✅**.
2. It sets out what each part of the product must do. Requirement IDs (for example `SIGN-03`) can be referred to in issues and pull requests.
3. It is the reference for anyone joining the project.

Requirement priorities: **Must** means needed for launch, **Should** means wanted for launch but not blocking, and **Later** means after launch.

---

## 1. Vision and goals

**Vision:** A bar manager can plan and publish the staff schedule in minutes, and every employee always knows when they work, on their phone. The software is free and open, so any bar can run it, change it and share it.

**Goals for the first public version (launch):**
- **Self-hosting:** someone with basic server skills gets their own copy running with Docker in **under 30 minutes**.
- **Contributors:** a developer runs the project locally and its tests with one command.
- **Hosted service:** a bar finds it, signs up and starts a free trial **on its own, without contacting us**.
- During the trial on the hosted service, the bar plans and publishes its first week.
- On the hosted service the bar pays by card, and billing runs automatically.
- Each bar's data is fully separated from all other bars and handled according to GDPR.
- Supporting a bar takes us minutes, through the platform admin view.

**Success measures (targets for the first 12 months after launch):**

The typical ranges are rough reference points for small business software, used to set the first targets. Review the targets after 6 months.

| Measure | Typical range | Target | How it's measured |
|---|---|---|---|
| **Hosted service** | | | |
| Paying bars | | **25 in Finland** (about 2 new bars a month) | Stripe: organizations' bars in `active` |
| Monthly recurring revenue | | **€250 a month** (25 bars × €10, without VAT) | Stripe |
| Trials that publish a week within 7 days | 40–60% | **60%** | App: first week locked within 7 days of sign-up |
| Trial to paid conversion | 40–60% with a card required at the start (D4); 15–25% without | **50%** | Stripe: trials that become `active` |
| Monthly churn | 3–7% a month; higher for restaurants and bars, partly because venues close | **under 4% a month** (about 40% a year) | Stripe: bars cancelled ÷ bars active at the start of the month |
| Support requests per 10 bars per month | 1–3 for simple self-service tools | **2 or fewer** | Support inbox |
| **Open source** | | | |
| Docker image downloads | hundreds to a few thousand in year 1 for niche self-hosted apps | **1,000** | Docker Hub / GitHub Container Registry statistics |
| GitHub stars | | **200** | GitHub |
| Outside contributors | a handful for niche projects | **5 people with a merged pull request** (translations count) | GitHub |

Self-hosted *installs* can't be counted: self-hosted copies never contact us (D14). Docker image downloads, stars, and issues from self-hosters are used as signals instead.

**Not in scope for launch:**
- Payroll
- Time clock / punching in and out
- Shift swapping between employees
- Native mobile apps (the PWA covers phones)
- Integrations with point-of-sale or accounting systems

---

## 2. Decisions needed before building

| # | Decision | Options | Recommendation | Chosen | Affects |
|---|---|---|---|---|---|
| ✅ D1 | Who is the customer? | Single bars / chains / both | Both, using an **organization** (the paying customer) above bars, from day one | **Both**, with organizations above bars | Data model (§10), billing (§7.3) |
| ✅ D2 | Launch country | Finland / Nordics / English-speaking market | One country first | **Finland first**; English-speaking markets next | Translations, legal, VAT |
| ✅ D3 | Pricing model (hosted service) | Flat per bar / per active employee / tiers by employee count | Tiers by active employees per bar | **Flat price per bar**: €10 a month or €100 a year, without VAT; all features included (§7.3) | Billing (§7.3) |
| ✅ D4 | Trial (hosted service) | Length; card required at start or not | 30 days, no card at start | **30 days, card required at sign-up**; charged automatically when the trial ends | Sign-up (§7.2), lifecycle (§10.2) |
| ✅ D5 | How users log in | Username / email / email + optional username | Email for everyone | **Email**. Employees without email get a printed invite code (AUTH-04). | Auth, invites, password reset |
| ✅ D6 | Bar address in the app | One app domain / own subdomain per bar | One app domain at launch | **One app domain**; a subdomain per bar maybe later (TEN-05) | DNS, cookies, onboarding |
| ✅ D7 | Hosting region | EU only / several regions | EU only at launch | **One region (EU) at launch**, designed so more regions can be added later | Hosting, GDPR (§8.2), data model (§10) |
| ✅ D8 | What happens when payment fails | Immediate lock / read-only grace period | 14 days read-only, then locked; deleted after 90 days | **As recommended**: 14 days read-only, then locked; data deleted after 90 days | Lifecycle (§10.2), billing (§7.3) |
| ✅ D9 | Project website technology | Inside the React app / separate static site / website builder | Separate static site | **Astro with the Starlight docs theme**, in a `website/` folder of the repository, on a free static host | Project website (§7.1), architecture (§9) |
| ✅ D10 | Licence | AGPL-3.0 / MIT / Apache-2.0 | AGPL-3.0 | **AGPL-3.0.** Anyone may use, change and self-host it; whoever offers a changed version to others over a network must publish their changes. | Legal (§12), repository |
| ✅ D11 | Hosted service vs self-hosted | Same features / open core / free hosted | Same features | **Same features.** Everything is open source; the hosted service charges for hosting, backups, updates, email and support. Billing code only runs in hosted mode. | Deployment modes (§6), billing (§7.3) |
| ✅ D12 | Contributor terms | DCO sign-off / CLA | DCO (`git commit -s`). A CLA is only needed if dual licensing is wanted later. | **DCO sign-off** | CONTRIBUTING.md |
| ✅ D13 | Name and trademark | No policy / trademark policy | A short trademark policy: forks may use the code but must not present themselves as the official hosted service. | **Trademark policy** (OSS-10) | Legal (§12), project website |
| ✅ D14 | Usage data from self-hosted copies | None / opt-in / opt-out | None by default; at most an opt-in, anonymous version check. | **None.** Self-hosted copies never contact us. | Privacy (§8.2), SELF requirements |
| ✅ D15 | UI language at launch | Finnish / English / both | Both: Finnish for the Finnish launch, English for the next markets. Translations are built in from the start anyway (§8.4). | **Both Finnish and English** | App, project website, emails |

---

## 3. Current state (what exists today)

The codebase already covers most of the scheduling product. Summary as of 2026-10-04:

| Area | Status |
|---|---|
| Several bars in one installation | ✅ Every bar table has `bar_id`. The bar always comes from the logged-in user (`utils/tenant.js`), never from the request. Tests check that bars are kept apart. |
| Roles | ✅ `adminGroup` (platform), `managerGroup`, `employeeGroup`. A user can be in several groups. |
| Platform admin | ✅ Create, edit and delete bars; add, edit and remove managers; reset passwords. |
| Managers | ✅ Add, rename and remove employees; reset their passwords. |
| Scheduling | ✅ Week and month views; drag, resize, add (several days at once) and delete shifts; employee order per day. |
| Publishing | ✅ Planning and locked weeks. Employees see only the last locked snapshot. |
| Mobile | ✅ PWA, "My shifts" list, one-day view on phones, tap to edit on touch screens, last schedule shown offline. |
| Security basics | ✅ scrypt password hashes, JWT in an httpOnly cookie (7 days), all sessions ended on password change, login rate limit, helmet. |
| Login | ⚠️ By **username**, unique across all bars. No email, no self-service password reset. |
| Per-bar settings in the UI | ✅ The app uses each bar's timezone, opening hours, 12/24-hour clock and accent colour; managers edit them on a Bar settings page (TEN-01–02). Logo and first day of week are still to do. |
| Translations | ✅ The app is in English and Finnish (react-i18next). A bar's users see the bar's language; admins and the login page get the browser's language. Weekday and month names follow it. ⚠️ Error messages from the server are still English only. |
| Sign-up, billing, project website, email | ❌ Not started. |
| Deleting a bar | ⚠️ Immediate hard delete, with no export and no grace period. |
| Operations | ⚠️ CI (lint, tests, licence check, Docker build, DCO) and release workflows exist. No staging environment or monitoring yet. Self-hosters have a backup guide. |
| Open-source readiness | ✅ Phase 1a (see §13): the public repository (`github.com/harautia/myWorkSchedule`) has AGPL-3.0, community files, a trademark policy, a Docker image and Compose files, settings from environment variables (the footer no longer hard-codes the author), `npm run create-admin`, a health check and the project website in `website/`. No secrets in git history. ⚠️ The author's email remains in older commits. |

---

## 4. Users (personas)

| Persona | Who | Main need | Device |
|---|---|---|---|
| **Visitor** | Bar owner or manager evaluating tools | Understand quickly what it does and what it costs; try it without talking to sales | Laptop or phone |
| **Account owner** | Bar owner or chain HR | Pay, manage the subscription, add bars and managers, get invoices | Laptop |
| **Manager** | Shift manager of one or more bars | Plan the week quickly, publish it, make last-minute changes | Laptop for planning, phone for changes |
| **Employee** | Waiter or bartender | See their own shifts, get told when the schedule changes | Phone |
| **Platform admin / support** | Us (hosted), or the self-hoster | Help a bar, see its subscription state, fix data safely | Laptop |
| **Self-hoster** | A bar's IT-minded owner, a chain's IT, or a hosting partner | Install, configure, back up and update their own copy | Server / laptop |
| **Contributor** | Developer who uses or likes the project | Run it locally, understand the code, get changes merged | Laptop |

---

## 5. User journeys

**J1 From visitor to trial**
1. A visitor arrives on the project website from search or an ad.
2. They read the features and pricing and click **Start free trial**.
3. They enter: their name, email, password, bar name, country, timezone and opening hours.
4. They enter card details in Stripe Checkout. Nothing is charged until the trial ends (D4).
5. They verify their email.
6. They land in their bar with an onboarding checklist:
   1. Invite staff
   2. Plan the first week
   3. Lock (publish) it

**J2 From trial to paying**
1. A reminder is sent 7 days before the trial ends, with a link to cancel.
2. When the trial ends, the card is charged automatically and the subscription becomes active.
3. If the charge fails, the bar becomes **past due** (J5).

**J3 Inviting an employee**
1. The manager enters the employee's name and email, and their role.
2. The employee gets an email with a link and sets their own password.
3. The employee lands in "My shifts".
4. If the employee has no email, the manager can print an invite code instead.

**J4 Planning and publishing a week** (exists today)
1. The manager plans in a planning week.
2. The manager clicks **Lock week**.
3. Employees see the week and are notified by email or push (**Should**).

**J5 Payment fails**
1. Stripe retries the payment.
2. The bar becomes **past due**: a banner shows, and the owner gets an email.
3. After the grace period the bar becomes read-only, then locked.
4. Data is deleted after the retention period. The owner is warned before this happens.

**J6 Cancelling**
1. The owner cancels in the billing portal.
2. Access continues to the end of the paid period.
3. A data export is offered.
4. The data is deleted after the retention period.

**J7 Support**
1. A bar contacts us.
2. We find the bar in the platform admin view, see its subscription status and usage, and can open its view in support mode.
3. Every support action is written to an audit log.

**J8 Self-hosting**
1. The self-hoster reads the self-hosting guide and copies `docker-compose.yml` and `.env.example`.
2. They set the domain, secrets and SMTP details, and run `docker compose up -d`.
3. Migrations run on start. They create the first admin with a setup command, or on a first-run screen.
4. As admin they create the bar and its first manager, as on today's Bars page.
5. Updating means pulling a new version tag and restarting; migrations run again automatically.

**J9 Contributing**
1. A developer forks the repository, runs one command to start Postgres and the app, and runs the tests.
2. They open a pull request with a DCO sign-off. CI must pass, and a maintainer reviews it.

---

## 6. Open source and deployment modes

The project is **one codebase and one Docker image** that runs in two modes. The mode is chosen with configuration, never with a separate build.

| | Self-hosted (`DEPLOYMENT_MODE=self-hosted`, default) | Hosted (`DEPLOYMENT_MODE=hosted`) |
|---|---|---|
| Who runs it | Anyone | The author, on the official domain |
| Features | All scheduling features | The same |
| Billing | None | Stripe billing with a trial, flat price per bar (§7.3) |
| New organizations | Created by the admin; public sign-up optional (`ALLOW_SIGNUP=true`) | Public self-service sign-up (§7.2) |
| Email | Any SMTP server | SMTP or a provider's API |
| Outside services | None required | Stripe, email provider, Sentry, monitoring |
| Project website | Uses the official project website for documentation | Pricing and sign-up pages on the project website (§7.1) |
| Platform admin | The self-hoster | The author / support |

### 6.1 Self-hosting requirements

| ID | Requirement | Priority |
|---|---|---|
| SELF-01 | Official Docker image (the backend serving the built frontend) published for every release, and a `docker-compose.yml` with the app and Postgres. | Must |
| SELF-02 | All configuration through environment variables, each one documented in `.env.example` and the configuration reference. Safe defaults; in production the app refuses to start without a session secret. | Must |
| SELF-03 | Database migrations run automatically on start, or with one documented command. | Must |
| SELF-04 | The first admin is created with a setup command (for example `npm run create-admin`) or a first-run screen that only works while no admin exists. Replaces the development seed for real installations. | Must |
| SELF-05 | Works with **no outside services**: email through any SMTP server, and no Stripe, Sentry or analytics needed. | Must |
| SELF-06 | Self-hosting guide: requirements, installing, HTTPS behind a reverse proxy, backups and restore, upgrades. | Must |
| SELF-07 | Versioned releases (semantic versioning) with a changelog that points out breaking changes and manual upgrade steps. | Must |
| SELF-08 | Health check endpoint (for example `GET /api/health`) for Docker and monitoring. | Must |
| SELF-09 | The operator details shown in the app (name, contact email, privacy policy link) come from configuration (`APP_OPERATOR_NAME`, `APP_CONTACT_EMAIL`, `APP_PRIVACY_URL`), not from the code. | Must |
| SELF-10 | One-click deploy templates for common hosts (for example Render, Fly.io). | Later |

### 6.2 Open-source project requirements

| ID | Requirement | Priority |
|---|---|---|
| OSS-01 | `LICENSE` with the full AGPL-3.0 text, and a licence note in the README. | Must |
| OSS-02 | A "Source code" link in the app footer that points to the source of the running version, which AGPL requires for changed copies (`APP_SOURCE_URL`, defaulting to the official repository). | Must |
| OSS-03 | `CONTRIBUTING.md` (local setup, tests, code style, DCO sign-off), `CODE_OF_CONDUCT.md`, and `SECURITY.md` (private vulnerability reporting through GitHub security advisories). | Must |
| OSS-04 | Issue templates (bug, feature request) and a pull request template with a checklist. | Should |
| OSS-05 | CI runs lint, tests and a dependency licence check on every pull request, including from forks, and checks that every commit has a DCO sign-off (D12). | Must |
| OSS-06 | Documentation published in the Docs section of the project website (LAND-09): self-hosting guide, configuration reference, architecture overview, API reference (OpenAPI), and this specification. The sources live in the repository. | Must |
| OSS-07 | No secrets or personal data in the repository or its history. Development accounts and passwords stay in the seed, clearly marked as development-only. | Must |
| OSS-08 | A public roadmap (GitHub Projects, or issues with labels such as `good first issue`). | Should |
| OSS-09 | Translations can be contributed without changing code: translation files, and optionally a translation platform. | Should |
| OSS-10 | Trademark policy (D13) in `TRADEMARK.md` and on the project website: forks may use and change the code, but must use their own name and logo and not present themselves as the official hosted service. | Must |

---

## 7. Functional requirements

### 7.1 Project website

One public website (D9) serves everyone: **bars** looking at the hosted service, and **self-hosters and contributors** looking for documentation. It's built with Astro and the Starlight docs theme in the `website/` folder of the repository, and deployed separately from the app.

| ID | Requirement | Priority |
|---|---|---|
| LAND-01 | Pages for everyone: Home (value, screenshots, how it works), Features, FAQ, Docs (LAND-09), Changelog, Contribute, link to the source code. | Must |
| LAND-02 | Hosted service pages: Pricing, Start free trial, Log in, Contact, and legal pages (Terms of service, Privacy policy, Cookie policy, Data processing agreement, Subprocessors). | Must |
| LAND-03 | Available in Finnish and English (D15). New languages can be added without code changes. | Must |
| LAND-04 | Fast and indexable by search engines: static HTML, Lighthouse score of at least 90, Open Graph tags, sitemap. | Must |
| LAND-05 | Analytics without tracking cookies (for example Plausible), or a cookie consent banner. | Must |
| LAND-06 | Pricing page shows the price per bar (§7.3). It is easy to update when prices change. | Must |
| LAND-07 | Short demo video, or a read-only demo bar. | Should |
| LAND-08 | Customer stories and testimonials. | Later |
| LAND-09 | Docs section (Starlight): self-hosting guide, configuration reference, architecture, API reference, contributing guide, with search. | Must |
| LAND-10 | Deployed automatically from `main` to a free static host (for example Cloudflare Pages or Netlify), independent of app releases. | Must |

### 7.2 Sign-up and onboarding

| ID | Requirement | Priority |
|---|---|---|
| SIGN-01 | Self-service sign-up creates: an organization, its first bar, and its first user. Always on in hosted mode. In self-hosted mode only when `ALLOW_SIGNUP=true`; otherwise the admin creates organizations. That user is the account owner and a manager of the bar. (The current `POST /api/admin/bars` already creates a bar together with its first manager.) | Must |
| SIGN-02 | Required fields: name, email, password, bar name, country, timezone (suggested from the browser), opening hours. In hosted mode, card details through Stripe Checkout at sign-up, not charged until the trial ends (D4). | Must |
| SIGN-03 | Email verification before the bar can invite staff. | Must |
| SIGN-04 | Bot protection on sign-up (for example Cloudflare Turnstile) and rate limits. | Must |
| SIGN-05 | Onboarding checklist in the app: invite staff, plan the first week, lock it. Completed steps are saved. | Should |
| SIGN-06 | Optional sample data ("fill a demo week") that can be removed with one click. | Should |
| SIGN-07 | A user can create a second bar under the same organization. In hosted mode this adds one bar to the subscription. | Should |

### 7.3 Pricing, billing and subscription (hosted mode only)

None of this runs in self-hosted mode: there are no prices or payments, and every organization is treated as `active`.

Pricing (D3): **€10 per bar per month, or €100 per bar per year** (two months free). Prices are without VAT; VAT is added at checkout (BILL-04). All features are included, and an organization's subscription has one item per bar.

| ID | Requirement | Priority |
|---|---|---|
| BILL-01 | The price per bar (monthly and yearly) is defined in one place, as Stripe prices. No limits on employees or features. | Must |
| BILL-02 | Card collected through Stripe Checkout at sign-up; the trial is a 30-day Stripe trial that charges automatically at the end (D4). Card changes, monthly/yearly switch, invoices and cancelling through the Stripe customer portal. | Must |
| BILL-03 | Stripe webhooks keep the organization's subscription status up to date (§10.2). | Must |
| BILL-04 | VAT handled correctly: Finnish VAT for Finnish customers, VAT number and reverse charge for business customers in other EU countries. Use Stripe Tax so later markets work too. | Must |
| BILL-05 | Adding or removing a bar changes the number of bars in the subscription, with prorated charges. Removing a bar follows DATA-02. | Must |
| BILL-06 | Access by status: `trialing` and `active` give full access; `past_due` shows a banner; `read_only` allows viewing only; `locked` shows only billing and export; `deleted` means the data is gone (D8). | Must |
| BILL-07 | Emails: trial ends in 7 days (with a cancel link), payment failed, read-only soon, data deletion soon, receipts (Stripe). | Must |
| BILL-08 | Yearly billing at €100 per bar (two months free). | Should |
| BILL-09 | Coupons and partner codes. | Later |

### 7.4 The bar's own view (the tenant)

Each bar works in its own view, which uses that bar's settings, staff and schedule.

| ID | Requirement | Priority |
|---|---|---|
| TEN-01 | Bar settings: name, logo, accent colour, country, language, timezone, opening and closing time (closing may be after midnight), first day of week, 12/24-hour clock. | Must |
| TEN-02 | **The frontend uses the bar's timezone and opening hours everywhere** instead of the current constants in `frontend/src/utils/dates.js`. All times are shown in the bar's timezone, wherever the user is. | Must |
| TEN-03 | The bar's logo and name in the app header and in emails. | Should |
| TEN-04 | An organization with several bars: managers of the organization can switch between bars; an employee can belong to several bars. | Should |
| TEN-05 | Own subdomain per bar (`<slug>.app.example.com`) or a custom domain (D6). | Later |
| TEN-06 | Bar roles beyond waiter and manager, defined by the bar (bartender, kitchen, door, …). | Should |

### 7.5 Accounts, invites and authentication

| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | Log in with **email and password**. Emails are unique across the service. Existing usernames are migrated (D5). | Must |
| AUTH-02 | Invites by email: a link that is valid for 7 days and can be used once; the person sets their own password. Replaces the manager setting passwords. | Must |
| AUTH-03 | "Forgot password" by email, with a single-use reset link valid for 1 hour. A reset ends all sessions (exists: `session_version`). | Must |
| AUTH-04 | Employees without email: the manager prints a one-time invite code. | Should |
| AUTH-05 | Optional two-factor authentication (TOTP) for account owners and managers. Required for platform admins. | Should (Must for admins) |
| AUTH-06 | Users can see and end their active sessions. | Later |
| AUTH-07 | Sign in with Google or Microsoft. | Later |

### 7.6 Scheduling (exists; changes for the service)

| ID | Requirement | Priority |
|---|---|---|
| SCH-01 | Keep the current features: planning and locked weeks, published snapshot for employees, week, month and My shifts views, adding shifts on several days, mobile editing. | Must |
| SCH-02 | Notify employees when a week they have shifts in is locked, or locked again after changes: email and/or web push (PWA phase B). | Should |
| SCH-03 | Personal calendar feed (iCal link) of the employee's published shifts. | Should |
| SCH-04 | Copy last week as the starting point for a new week. | Should |
| SCH-05 | Labour rule warnings by country (for example rest time between shifts, weekly hours). Warnings only, never blocking. | Later |
| SCH-06 | Employee availability and time-off requests. | Later |
| SCH-07 | Shift swap requests that a manager approves. | Later |
| SCH-08 | Export a week to PDF or print. | Should |

### 7.7 Notifications and email

| ID | Requirement | Priority |
|---|---|---|
| NOT-01 | Sending through **any SMTP server** (self-hosted), or a transactional email service such as Postmark, Resend or AWS SES (hosted), from a verified domain with SPF, DKIM and DMARC. If email isn't configured, the app still works and shows invite links for the manager to share. | Must |
| NOT-02 | Emails are translated, use the bar's name and logo, and have a plain-text version. | Must |
| NOT-03 | Users choose which notifications they receive. Required emails (security, billing) can't be turned off. | Should |
| NOT-04 | Web push for installed PWAs (needs VAPID keys, a subscriptions table, and sending on lock). | Should |

### 7.8 Platform admin and support

In self-hosted mode the self-hoster is the platform admin, and billing-related actions are hidden.

| ID | Requirement | Priority |
|---|---|---|
| ADM-01 | List of organizations and bars, with subscription status, number of bars, trial end, active employees and last activity. Search and filters. (Builds on today's Bars page.) | Must |
| ADM-02 | Open a bar in **support mode**: read-only by default. Every action is written to the audit log with who did it and why. | Must |
| ADM-03 | Hosted mode: extend a trial or give a discount (through Stripe). | Should |
| ADM-04 | Service health view: error rate, sign-ups and conversions. | Later |

### 7.9 Data export, retention and deletion

| ID | Requirement | Priority |
|---|---|---|
| DATA-01 | The account owner can export all bar data (employees, shifts, published weeks) as CSV/JSON. | Must |
| DATA-02 | Deleting a bar or organization is **scheduled** with a grace period (for example 30 days) during which it can be undone, then permanently deleted. Replaces today's immediate hard delete. | Must |
| DATA-03 | Data of cancelled or unpaid organizations is deleted after the retention period: 90 days (D8). | Must |
| DATA-04 | A person's data can be exported or erased on request (GDPR). Past shifts of an erased employee are anonymised, not deleted, so the bar's history stays complete. | Must |

---

## 8. Non-functional requirements

### 8.1 Security
| ID | Requirement |
|---|---|
| SEC-01 | Keep tenant isolation in the application, where the bar comes from the session and never from the request. Add **Postgres row-level security** as a second safeguard. Keep and extend the cross-bar tests. |
| SEC-02 | Rate limits on login, sign-up, invites and password reset (login exists). |
| SEC-03 | Content Security Policy in production (currently off, see `backend/app.js`). |
| SEC-04 | Secrets only in environment variables or a secrets manager. Rotate the session secret without logging everyone out (support two keys at a time). |
| SEC-05 | Automated dependency updates and `npm audit` in CI. Test with the OWASP Top 10 in mind before launch. |
| SEC-06 | Audit log of security and admin events: logins, password changes, role changes, support access, deletions. |

### 8.2 Privacy and GDPR
- **Roles:** for the bar's staff data, the bar is the *controller* and we are the *processor*. For account owners' own data (billing, marketing), we are the controller.
- **Legal documents:** a data processing agreement (DPA) accepted at sign-up, and a public list of subprocessors (hosting, email, Stripe, error tracking).
- **Data location:** on the hosted service all customer data is stored in the EU (D7). Each organization records its region, so a second region (for example the US) can be added later as a separate deployment. Self-hosters choose their own location and take on the processor or controller role themselves.
- **Self-hosted copies send no data to us** (D14): no usage statistics and no version checks.
- **Minimisation:** we store names, emails, roles and shifts. No sensitive personal data.
- **Cookies:** the app uses one necessary session cookie only. The project website uses analytics without cookies, or asks for consent.

### 8.3 Reliability and performance
| ID | Target |
|---|---|
| OPS-01 | Hosted service: availability of at least 99.5% per month, which allows about 3.6 hours of downtime a month. Self-hosters run their own copy and set their own targets. |
| OPS-02 | Daily database backups kept for 30 days, with point-in-time recovery. A restore is tested every quarter. |
| OPS-03 | Week view loads in under 1 second for a bar with 50 employees on a 4G phone. |
| OPS-04 | Error tracking (Sentry) for frontend and backend, uptime monitoring, and structured logs that don't contain personal data. |
| OPS-05 | Separate **staging** and **production** environments. Database migrations run automatically on deploy. |
| OPS-06 | CI runs lint, backend and frontend tests on every pull request. Deploys come from `main`. |

### 8.4 Accessibility, devices and localization
- **Accessibility:** WCAG 2.1 AA for the app and the project website, including keyboard use, contrast and screen reader labels.
- **Devices:** the two latest versions of Chrome, Safari, Firefox and Edge; iOS 16.4 or newer and Android 10 or newer for the PWA.
- **Translations:** all UI text through a translation library (for example react-i18next). Dates, times and numbers are formatted with the bar's locale. Launch in Finnish and English (D15); add more without code changes.
- **Time:** times are stored in UTC and shown in the bar's timezone. A shift belongs to the bar day it starts on, a rule that is already implemented in `backend/utils/weeks.js`.

---

## 9. Architecture overview

```
           www.example.com                    app.example.com
     ┌─────────────────────────┐        ┌──────────────────────────┐
     │ Project website (Astro) │──────▶│ React PWA (Vite)         │
     │ docs, pricing, sign-up  │ log in │ the bar's own view       │
     └─────────────────────────┘        └────────────┬─────────────┘
                                                      │ /api (JSON, cookie session)
                                         ┌────────────▼─────────────┐
           Stripe ──webhooks──────────▶ │ Express API              │──▶ Email service
                                         │ tenant from the session  │──▶ Web push
                                         └────────────┬─────────────┘
                                                      │
                                         ┌────────────▼─────────────┐
                                         │ PostgreSQL (EU)          │
                                         │ row-level security       │
                                         └──────────────────────────┘
```

- **Two deployments, one image.** A self-hosted copy is the app container plus Postgres, behind the self-hoster's reverse proxy for HTTPS. It needs nothing else; SMTP is optional. The hosted service is the same image with `DEPLOYMENT_MODE=hosted`, plus Stripe, an email provider and monitoring, as drawn above.
- **One** backend and one database for all bars. A shared schema with `bar_id` on every row (already in place) scales to thousands of bars. Separate databases per bar aren't needed.
- **Background jobs:** emails, trial reminders, scheduled deletions and push sending. Use a job queue (for example pg-boss, which runs on the existing Postgres) so that the API stays fast.
- **Project website** (`website/`, Astro + Starlight) is deployed separately to a static host, so website and documentation changes don't need an app release.
- **Regions:** one EU deployment at launch (D7). A later region is another deployment of the same image with its own database; organizations keep their `region`.

---

## 10. Data model changes

### 10.1 New and changed tables (proposal)

| Table | Purpose | Key columns |
|---|---|---|
| `organizations` (new) | The paying customer. One or more bars. | `id`, `name`, `country`, `region` (default `eu`), `billing_email`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`, `current_period_ends_at`, `scheduled_deletion_at` |
| `bars` (changed) | A venue. | + `organization_id`, `locale`, `week_starts_on`, `clock_24h`, `logo_url`, `accent_color`, `slug` (for later subdomains), `scheduled_deletion_at` |
| `users` (changed) | A person who logs in. | + `email` (unique), `email_verified_at`, `totp_secret`. `username` becomes optional and is phased out. `bar_id` moves to memberships. |
| `memberships` (new) | Which bars a user belongs to, with which role. | `user_id`, `bar_id`, `employee_id`, `role` (owner / manager / employee). Replaces `user_groups` for bar roles; `adminGroup` stays as a platform flag. |
| `invites` (new) | Pending invites. | `bar_id`, `email`, `role`, `token_hash`, `expires_at`, `accepted_at`, `invited_by` |
| `password_resets`, `email_verifications` (new) | Single-use tokens. | `user_id`, `token_hash`, `expires_at`, `used_at` |
| `audit_log` (new) | Security and admin events. | `organization_id`, `bar_id`, `actor_user_id`, `action`, `details` (jsonb), `created_at` |
| `push_subscriptions` (new) | Web push (NOT-04). | `user_id`, `endpoint`, `keys`, `created_at` |
| `stripe_events` (new) | Webhook events already handled, so each is processed only once. | `id`, `type`, `processed_at` |

### 10.2 Subscription lifecycle

```
trialing ──charged at trial end──▶ active ──payment fails──▶ past_due ──grace ends──▶ read_only ──▶ locked ──retention ends──▶ deleted
    │                                   ▲                          ▲ │                                   │
    │                                   └───────── paid ───────────┼─┴───────────────────────────────────┘
    └── charge at trial end fails ─────────────────────────────────┘
```

Because the card is collected at sign-up (D4), a trial never ends "without paying": either the charge succeeds, or the bar goes to `past_due`. Cancelling during the trial ends access when the trial ends.

The status is changed only by Stripe webhooks and the scheduled job, never by the client. One middleware checks it on every bar request, next to the existing `resolveBar`.

---

## 11. API changes (summary)

An OpenAPI description should be written as part of this work. New endpoint groups:

- `POST /api/signup`, `POST /api/verify-email`
- `POST /api/password-reset`, `POST /api/password-reset/confirm`
- `POST /api/invites`, `GET /api/invites/:token`, `POST /api/invites/:token/accept`
- `GET` and `PUT /api/bar/settings`; `GET /api/me/bars` and switching the current bar
- `POST /api/billing/checkout`, `POST /api/billing/portal`, `POST /api/stripe/webhook`
- `GET /api/export`; `DELETE /api/bar`, which schedules deletion
- Admin: `/api/admin/organizations`, support mode, audit log

---

## 12. Legal and business checklist

**Hosted service:**
- [ ] Company and VAT registration in Finland
- [ ] Terms of service and acceptable use
- [ ] Privacy policy (app and project website)
- [ ] Data processing agreement (DPA) for bars, and list of subprocessors
- [ ] Cookie policy, or analytics without cookies
- [ ] Terms and policies in Finnish and English (D15)
- [ ] Stripe account, Stripe Tax set up, refund policy
- [ ] Domain, business email, email sender domain (SPF, DKIM, DMARC)
- [ ] Support channel and response time promise
- [ ] Trademark and name check for the product name, and a short trademark policy for forks (D13)
- [ ] The hosted service's terms, privacy policy and DPA cover the hosted service, not the software

**Open source:**
- [ ] `LICENSE` (AGPL-3.0) in the repository, and a licence note in the README
- [ ] "Source code" link in the app (OSS-02), so users of any running copy can get its source
- [ ] All dependency licences compatible with AGPL (for example `license-checker` in CI)
- [ ] DCO sign-off described in CONTRIBUTING.md (D12)
- [ ] Personal details removed from the code: the footer's name and email move into configuration (SELF-09)

---

## 13. Roadmap

| Phase | Content | Done when |
|---|---|---|
| **0. Decide** | This spec reviewed | The owner has approved the spec |
| **1. Groundwork** | Staging and production environments, CI, backups, Sentry. Email service. Email login, invites, password reset (AUTH-01–03). Per-bar settings used in the UI (TEN-01–02). Translations set up. | A manager can invite staff by email, and the app shows the bar's own hours and timezone |
| **1a. Open-source ready** | LICENSE, trademark policy and community files (OSS-01–05, OSS-10). Operator details and footer from configuration (SELF-09). Docker image and Compose file, health check, first-admin command (SELF-01–04, SELF-08). `DEPLOYMENT_MODE` switch. Project website with the Docs section and the self-hosting guide (LAND-01, LAND-09–10). Publish the GitHub repository with a v0.1.0 release. | Someone else installs it from the guide and plans a week |
| **2. Sign-up** | Organizations and memberships (§10). Self-service sign-up and trial (SIGN-01–04). Onboarding checklist. | A stranger can start a trial and publish a week without our help |
| **3. Billing (hosted mode)** | Stripe Checkout with trial and card at sign-up, portal, webhooks, lifecycle, price per bar (BILL-01–07). Admin console extensions (ADM-01–02). | A bar can pay, and unpaid bars become read-only on schedule |
| **4. Hosted service pages and legal** | Pricing, trial and legal pages on the project website (LAND-02–06), data export and scheduled deletion (DATA-01–04), security review | Ready to take real customers |
| **5. Launch** | Launch the hosted service in Finland, and announce v1.0 of the open-source project. Monitor the success measures. | First paying bars and first outside self-hosters |
| **6. Grow** | Notifications and calendar feed (SCH-02–03, NOT-04), more languages, chains (TEN-04), copy week (SCH-04) | Driven by customer feedback |

---

## 14. Acceptance and testing

- **Requirement IDs:** every Must requirement has acceptance criteria written in the issue that implements it, and at least one automated test.
- **Tenant isolation tests** (as in `backend/tests/auth.test.js`) are extended for every new endpoint: a user of one bar must never read or change another bar's data.
- **Billing:** tested with Stripe test mode and the Stripe CLI to send webhooks, covering every state change in §10.2.
- **End-to-end:** before launch, a walk-through of journeys J1–J7 on staging, on a laptop and on a phone.

---

## 15. Open questions

- A discount for chains with many bars?
- Is a phone number needed (for SMS notifications) in some markets?
- Which English-speaking market comes after Finland, and does it need its own region (D7)?
- Who can see wages or hours totals, if those are added later?
- Is there a free or cheaper option for very small bars on the hosted service?
- Sponsorship for the open-source project (GitHub Sponsors, Open Collective)?
- How are feature requests from self-hosters weighed against the needs of hosted customers?
- How long do older versions get security fixes (for example only the latest minor version)?
- Paid support or installation help for self-hosters?

---

## Glossary

| Term | Meaning |
|---|---|
| **Bar** | A venue whose schedule is planned. Today's tenant. |
| **Organization** | The paying customer; owns one or more bars. |
| **Bar day** | Opening to closing, which may continue after midnight. A shift belongs to the bar day it starts on. |
| **Planning / locked week** | A week that managers can change, or a week that is published and closed for changes. |
| **Published snapshot** | The version of a week that employees see, saved when the week was last locked. |
| **PWA** | Progressive Web App: the web app installed on a phone's home screen, with offline viewing. |
| **Tenant isolation** | Guarantee that one customer's data is never visible to another. |
| **AGPL-3.0** | GNU Affero General Public License v3, a copyleft licence. Anyone who offers a changed version to users over a network must make that version's source available to them. |
| **DCO** | Developer Certificate of Origin. Contributors sign each commit (`git commit -s`) to state they have the right to contribute it. |
| **Self-hosted** | A copy of the app run by someone else on their own server, in `DEPLOYMENT_MODE=self-hosted`. |
| **Hosted service** | The official copy run by the author, with billing, in `DEPLOYMENT_MODE=hosted`. |

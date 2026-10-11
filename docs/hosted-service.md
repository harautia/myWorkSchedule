# Running the hosted service

This is for whoever runs the official hosted service (`DEPLOYMENT_MODE=hosted`).
Self-hosted copies don't bill and can skip this page.

On the hosted service, every new bar signs up, gives a card in Stripe Checkout, gets a
30-day free trial, and is charged automatically after it: €10 a month or €100 a year per
bar, without VAT (spec §7.3). Stripe sends receipts; the app sends the other billing
emails.

## 1. Settings

In addition to the usual settings (see `.env.example`):

| Variable | What it is |
|---|---|
| `DEPLOYMENT_MODE=hosted` | Turns billing on. Sign-up is also on by default. |
| `APP_URL` | The app's public address, e.g. `https://app.example.com`. Stripe returns customers here. |
| `STRIPE_SECRET_KEY` | **Developers → API keys → Secret key** (`sk_test_…` in test mode). |
| `STRIPE_WEBHOOK_SECRET` | The webhook's signing secret (`whsec_…`), see step 3. |
| `STRIPE_PRICE_MONTHLY` | The id of the €10 monthly price (`price_…`), see step 2. |
| `STRIPE_PRICE_YEARLY` | The id of the €100 yearly price. |

The app refuses to start in hosted mode while any of these is missing.

## 2. Stripe dashboard

Do all of this first in **test mode** (the toggle in the dashboard), then again in live mode.

1. **Product and prices.** Product catalogue → Add product: "myWorkSchedule bar". Add two
   recurring prices: €10.00 monthly and €100.00 yearly, both **exclusive of tax**. Copy the
   price ids into `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY`.
2. **Stripe Tax.** Settings → Tax: add your business address and a registration for
   Finland. Set the product's tax code to "Software as a service (SaaS) – business use".
   Checkout then adds Finnish VAT, and reverse charge for EU businesses that give a VAT
   number.
3. **Customer portal.** Settings → Billing → Customer portal: allow updating the payment
   method, switching between the monthly and yearly price, viewing invoices, and cancelling
   **at the end of the billing period**.
4. **Failed payments.** Settings → Billing → Subscriptions and emails → Manage failed
   payments: Smart Retries, and when all retries fail, **cancel the subscription**. The bar
   is then read-only for 14 days, locked after that, and its data is scheduled for deletion
   90 days after the end.
5. **Emails.** In the same settings, turn on receipts (successful payments). Leave Stripe's
   own trial reminder off: the app sends one 7 days before the trial ends.

## 3. Webhook

Developers → Webhooks → Add endpoint: `https://<your app>/api/stripe/webhook`, with these
events:

- `checkout.session.completed`
- `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `customer.subscription.paused`,
  `customer.subscription.resumed`
- `invoice.payment_failed`

Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

## 4. Trying it on your own computer

1. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run `stripe login`.
2. Forward webhooks to your local app; the CLI prints a `whsec_…` secret to use as
   `STRIPE_WEBHOOK_SECRET`:

   ```bash
   stripe listen --forward-to localhost:3003/api/stripe/webhook
   ```

3. Start the backend with the test-mode settings, e.g. in `backend/.env`:

   ```bash
   DEPLOYMENT_MODE=hosted
   APP_URL=http://localhost:5173
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...   # from stripe listen
   STRIPE_PRICE_MONTHLY=price_...
   STRIPE_PRICE_YEARLY=price_...
   ```

4. Open the app, choose **Create an account**, then **Start free trial**, and pay with the
   test card `4242 4242 4242 4242` (any future date, any CVC). Back in the app, the bar is
   in its trial.
5. To see the rest of the lifecycle, use Stripe's
   [test clocks](https://docs.stripe.com/billing/testing/test-clocks) to move past the
   trial end, or the test card `4000 0000 0000 0341` (attaches, but payments fail) for
   failed payments. In Stripe you can also cancel the subscription immediately to see the
   bar become read-only.

## 5. What happens when

| Status | When | The bar |
|---|---|---|
| `incomplete` | Signed up, no card yet | Only the owner's Billing page |
| `trialing` | Card given in Checkout | Everything |
| `active` | Paying | Everything |
| `past_due` | A payment failed, Stripe is retrying | Everything, with a banner; the owner is emailed |
| `read_only` | The subscription ended (all retries failed, or cancelled) | Everyone can see, nobody can change; 14 days |
| `locked` | 14 days after the end | Only the owner's Billing page |
| (deletion) | 90 days after the end | Recorded as `scheduled_deletion_at`; the deletion itself comes with spec DATA-03 |

Subscribing again from the Billing page (without a new trial) brings everything back.

An hourly job inside the app locks bars at the end of their read-only period and sends
the reminders: the trial ends in 7 days, the data is deleted in 7 days. Billing emails go
to each organization's owners, in their bar's language.

Bars the platform admin creates (rather than sign-up) have no subscription and are
free; use this for your own test bars or for partners.

## 6. Before opening to customers

- [ ] Replace every `[placeholder]` in `website/src/data/service.mjs`: the app's address,
      the operator's name, business ID, address and contact email, and the hosting and
      email providers in the subprocessor list.
- [ ] Fill in the `[placeholders]` left in the legal pages (`website/src/content/docs/legal/`
      and `fi/legal/`): the court district and the "Last updated" dates.
- [ ] Have a lawyer review the terms, privacy policy, cookie policy, data processing
      agreement and subprocessor list; then remove the "Draft" notice from each page.
- [ ] In the app's settings: `APP_OPERATOR_NAME`, `APP_CONTACT_EMAIL`, and
      `APP_PRIVACY_URL` pointing to the website's privacy policy.
- [ ] Two-factor login for the platform admin (spec AUTH-05; see `docs/security-review.md`).
- [ ] After deploying, open the app with the browser's console showing and check that the
      Content Security Policy blocks nothing: sign-up with Turnstile, Stripe Checkout and
      back, installing the PWA.

## 7. Data requests and deletion

- **Owners** download their bar's data (JSON, or the shifts as CSV) and delete the bar in
  Bar settings. Deletion happens 30 days later and can be undone until then; while the
  last bar of an organization waits for deletion, its subscription is set to end at the
  end of the period.
- **Managers** can anonymise an employee: the account and name go, the shifts stay.
- **Personal data requests** (GDPR) come to you: on the admin's Bars page, find the person
  by email, download their data, or erase them.
- The hourly job deletes bars whose deletion date has passed, and organizations 90 days
  after their subscription ended. Every export, deletion and erasure is in the audit log.

## 8. Support

The admin's Bars page lists every organization with its subscription status, trial end,
active users (logged in during the last 30 days) and last activity, with search and a
status filter.

To see a bar as its managers do, open it and choose **Open in support mode** with a
reason (for example the ticket number). Support mode is read-only and lasts at most an
hour. Opening and leaving it, subscription status changes and bar deletions are written to
the bar's audit log, shown on the same page.

# PaLoNex backend setup

## Local development

Use Node 24, npm, and Docker Compose. The Compose database uses trust authentication and binds to loopback. Use it only for local development or isolated tests.

1. Run `npm ci` and `docker compose up -d --wait`.
2. Copy `.env.example` to `.env.local` and set `ENQUIRY_SIGNING_SECRET` using `openssl rand -hex 32`.
3. Set `APP_ORIGIN` to the exact browser origin, for example `http://localhost:3000`. Run `npm run db:migrate`.
4. Run `npm run dev`, open the homepage and use the business enquiry section. Check `GET /api/health/database` before submitting.
5. Use a fresh database for integration and browser tests. The outbox integration test dispatches from the test queue and must run against an otherwise empty local database. See [the testing guide](TESTING_GUIDE.md).

## Production setup

Follow the [production deployment guide](PRODUCTION_DEPLOYMENT_GUIDE.md) for Neon provisioning, Vercel environment variables, migration and activation. Use the pooled runtime URL and direct operator URL with verified TLS. The consolidated runtime and maintenance privileges are in `db/ops/grants.sql`.

## API and operations

| Method and route | Contract |
| --- | --- |
| GET `/api/enquiries` | Issues a signed form token and minimum wait. Returns no enquiry data. |
| POST `/api/enquiries` | Requires same-origin JSON, consent and a valid token. Returns a UUID on creation or an identical replay. |
| GET `/api/health/database` | Returns readiness or a generic 503. |
| GET `/api/internal/notifications` | Requires bearer authentication and explicit mail opt-in. A manual invocation processes up to five due deliveries. |

The token enforces a 2.5-second minimum age and expires after two hours. Identical retries with the same valid token get the original reference. Separate tokens represent separate submissions. Fixed hourly quotas are three per normalized email, 12 per trusted IP or 60 for the shared fallback, and 240 overall. The database stores HMACs for rate-limit keys. These controls reduce abuse but cannot verify mailbox ownership or prove a submitter is human.

Outbox jobs use two-minute leases, row locking, exponential backoff and stable Resend idempotency keys. The worker records accepted sends and stops retrying after six attempts or 20 hours after the first attempt. Monitor failed jobs and queue age. Investigate before manually replaying any delivery outside the provider idempotency window. Enabling the worker also makes queued historical jobs eligible, so review the backlog before activation.

The company notification contains a reference and category. The acknowledgement contains the submitter’s name and reference. The enquiry message stays in PostgreSQL. Authorized staff can review enquiries and monitor the outbox in the [admin console](ADMIN_SETUP.md). Structured application logs carry event names, outcomes and opaque identifiers.

For public sign-in and the separate verification and recovery worker, follow [user auth setup](USER_AUTH_SETUP.md).

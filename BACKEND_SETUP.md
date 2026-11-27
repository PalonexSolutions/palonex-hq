# PaLoNex backend setup

## Local development

Use Node 24, npm, and Docker Compose. The Compose database uses trust authentication and binds to loopback. Use it only for local development or isolated tests.

1. Run `npm ci` and `docker compose up -d --wait`.
2. Copy `.env.example` to `.env.local` and set `ENQUIRY_SIGNING_SECRET` using `openssl rand -hex 32`.
3. Set `APP_ORIGIN` to the exact browser origin, for example `http://localhost:3000`. Run `npm run db:migrate`.
4. Run `npm run dev`, open the homepage and use the business enquiry section. Check `GET /api/health/database` before submitting.
5. Use a fresh database for integration and browser tests. The outbox integration test dispatches from the test queue and must run against an otherwise empty local database. See [the testing guide](TESTING_GUIDE.md).

## Production setup

- Provision PostgreSQL with enforced TLS and backups. Supabase PostgreSQL is compatible through standard PostgreSQL connections. Keep `palonex_private` outside PostgREST or other exposed schema lists.
- Run `npm run db:migrate` as the schema owner via a direct or session-mode connection before starting the release. Run migrations once per release. They use a transaction, advisory lock and checksums. Applied files are immutable.
- Set `DATABASE_URL` on the server to a TLS-verified connection using a transaction pooler when available. Use a runtime role separate from the migration owner. Set a database statement timeout on that role and keep `DATABASE_POOL_MAX` small. The default is three connections per warm instance. Provision within the provider's total connection budget.
- Set the canonical HTTPS `APP_ORIGIN` and an independent random `ENQUIRY_SIGNING_SECRET` of at least 32 characters. Configure preview origins separately. On Vercel the application uses the platform's `x-vercel-forwarded-for` header. Elsewhere, optionally set `ENQUIRY_TRUSTED_IP_HEADER` only if the proxy overwrites it with a single verified client IP. Without a trusted IP the application uses a shared quota.
- Set `CRON_SECRET` to another independently generated secret, `RESEND_API_KEY`, `ENQUIRY_EMAIL_FROM` to a sender on a verified domain, and `ENQUIRY_EMAIL_TO` to the monitored company inbox. Schedule an HTTPS GET to `/api/internal/notifications` with `Authorization: Bearer <CRON_SECRET>` at least every five minutes. Use a scheduler and hosting plan that support that cadence.
- Schedule `npm run db:prune` daily as a restricted maintenance role. Enquiries default to 365 days and rate-limit windows to two days. Review the public policy and backup retention when changing the enquiry retention period. Confirm the policy with the company before going live.
- Check database health, send a real enquiry with approved test data, confirm receipt of both emails, and verify access restrictions before opening public traffic.

Example grants for a precreated login role called `palonex_runtime`. Keep secrets in the hosting provider’s secret settings.

```sql
GRANT USAGE ON SCHEMA palonex_private TO palonex_runtime;
GRANT SELECT, INSERT ON palonex_private.enquiries TO palonex_runtime;
GRANT UPDATE (status, updated_at, status_changed_at) ON palonex_private.enquiries TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.enquiry_rate_limits TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.enquiry_notifications TO palonex_runtime;
ALTER ROLE palonex_runtime SET statement_timeout = '5s';
```

## API and operations

| Method and route | Contract |
| --- | --- |
| GET `/api/enquiries` | Issues a signed form token and minimum wait. Returns no enquiry data. |
| POST `/api/enquiries` | Requires same-origin JSON, consent and a valid token. Returns a UUID on creation or an identical replay. |
| GET `/api/health/database` | Returns readiness or a generic 503. |
| GET `/api/internal/notifications` | Requires scheduler bearer authentication. Processes up to five due deliveries. |

The token enforces a 2.5-second minimum age and expires after two hours. Identical retries with the same valid token get the original reference. Separate tokens represent separate submissions. Fixed hourly quotas are three per normalized email, 12 per trusted IP or 60 for the shared fallback, and 240 overall. The database stores HMACs for rate-limit keys. These controls reduce abuse but cannot verify mailbox ownership or prove a submitter is human.

Outbox jobs use two-minute leases, row locking, exponential backoff and stable Resend idempotency keys. The worker records accepted sends and stops retrying after six attempts or 20 hours after the first attempt. Monitor failed jobs and queue age. Investigate before manually replaying any delivery outside the provider idempotency window. Enabling the worker also makes queued historical jobs eligible, so review the backlog before activation.

The company notification contains a reference and category. The acknowledgement contains the submitter’s name and reference. The enquiry message stays in PostgreSQL. Until an authenticated administration interface exists, approved staff need restricted database access to review enquiries. Structured application logs carry event names, outcomes and opaque identifiers.

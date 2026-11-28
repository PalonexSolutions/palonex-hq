# First production deployment

PaLoNex HQ uses Vercel's native Next.js preset, Node.js 24, npm and the standard `npm run build`. The app has no custom server. PostgreSQL clients, authentication and workers use the Node runtime. The repository registers no cron jobs under the Vercel Hobby and Neon Free deployment model. Migrations and maintenance run explicitly outside Vercel builds.

## Access and approval

| Responsibility | Owner action |
| --- | --- |
| Repository engineering | Codex can run quality gates, test fixtures and isolated database operations, and prepare the release branch or pull request. |
| Neon | Owner creates the production database and a separate empty preview environment, creates roles, establishes recovery and runs direct operator commands. |
| Vercel | Owner imports the repository, verifies Node 24 and Hobby eligibility, and scopes settings to Preview and Production. |
| DNS and HTTPS | Owner adds the official domain, applies Vercel's actual DNS instructions and verifies the certificate. |
| Resend | Owner verifies the sending domain, adds the provided DNS records and prepares separate keys and senders. |
| Public launch | Owner approves terms, privacy, release, traffic, and mail activation after preview checks. |

## 1. Configure Neon

1. Create a production PostgreSQL branch and a separate empty preview database or branch containing no customer data. A separate preview project is acceptable. Avoid branching from populated production data. Use a schema owner and create `palonex_runtime` and `palonex_maintenance` as unprivileged PostgreSQL login roles. Creating roles in SQL avoids inheriting provider-admin memberships that may be assigned by dashboard-created roles. Verify memberships before use.
2. Use the Neon pooled endpoint for the Vercel role and Neon direct endpoints for migration, staff provisioning and maintenance. In the Neon connection dialog, verify the selected branch and role before copying the URL. Replace the SSL mode with `sslmode=verify-full`. The hosted URL accepts `sslmode`, `channel_binding` and `application_name` only. Node pg negotiates channel binding when offered. Never disable certificate validation.
3. Pin the pooled hostname in `NEON_RUNTIME_HOST`. In Preview, set `NEON_PRODUCTION_HOST` to the actual production pooled hostname. Confirm that the preview URL host and login differ from production. The app rejects role-variable mixing, unpooled runtime URLs, unexpected hosts and weak TLS settings. See the [environment matrix](PRODUCTION_ENVIRONMENT_MATRIX.md).
4. If using the Neon Vercel integration, enable preview branching only under the preview environment and verify its actual URL and branch on the Vercel side. Confirm the branch source has no customer data, and supply the per-preview endpoint pin alongside each resulting URL. If the integration cannot supply both reliably, use a manually provisioned isolated preview branch with a pinned alias. Installing it alone does not configure isolation.

## 2. Apply and verify migrations

On a trusted operator workstation with Node 24 and a PostgreSQL 17-compatible `psql`, check out the candidate commit. Establish an actual recovery point before upgrading any populated branch. Verify the Neon branch in the dashboard and confirm the target URL locally without exposing it.

```sh
npm ci
npm run db:status           # Nonzero when migrations are pending or invalid
npm run db:migrate           # DATABASE_URL_UNPOOLED must be the direct schema-owner URL
npm run db:status           # Expect applied=3 and pending=[]
psql "$DATABASE_URL_UNPOOLED" -v ON_ERROR_STOP=1 -f db/ops/grants.sql
```

Use protected operator tooling to inject `DATABASE_URL_UNPOOLED` and `NEON_RUNTIME_HOST`. Avoid command history and shared process inspection on the operator machine. Run grants after migrations and before traffic. Existing migration SQL is immutable. The runner checks ordered files and checksums, takes a transaction-scoped advisory lock, and commits the batch before reporting success. A failed batch rolls back. If no migration history exists but conflicting objects do, stop and inspect the branch.

Create the two roles once before applying grants, for example with `CREATE ROLE palonex_runtime LOGIN;` and `CREATE ROLE palonex_maintenance LOGIN;` and set strong per-role passwords through `psql`'s `\password` prompt. Use the owner or a specifically authorized provisioning role to bootstrap staff using [Admin setup](ADMIN_SETUP.md). Use the restricted maintenance role for `npm run db:prune -- --apply` only, after confirming the target. Test that runtime credentials cannot create private schema objects, delete enquiries or change audit records.

## 3. Prepare a protected preview

1. Import the repository on Vercel. Use the Next.js framework preset, Node 24, repository root and default npm build path. Set the production branch to `main` but keep the candidate on the release branch until approval. Enable system environment variables so `VERCEL_ENV` is available. Protect preview access.
2. Configure Preview values with a stable, exact HTTPS alias and an isolated Neon endpoint. Test the preview deployment from that alias. Raw deployment URLs and other origins may return authorization failures by design. Use `npm run deploy:check` with the scoped runtime environment loaded securely. Confirm hostname, HTTPS and cookie behavior in the actual preview.
3. Keep Preview mail paused for routine checks and use mocked or captured delivery in the local suite. Preview has no automatic email dispatch. An optional manual Preview mail check may use an existing no-cost Resend test key, verified test sender and one controlled mailbox in `PREVIEW_MAIL_TO`. Set the company inbox to that same address and use it for Preview accounts and enquiries. Follow the [manual worker procedure](PRODUCTION_OPERATIONS_RUNBOOK.md) and pause mail again afterwards.
4. Run the [preview smoke checklist](PRODUCTION_SECURITY_CHECKLIST.md). Capture results without credentials, customer data or account links. Turn preview mail back off when the checks complete.

## 4. Configure domain and optional manual processing

- Add `palonexsolutions.in` to the Vercel project as the canonical host. Add `www.palonexsolutions.in` only to redirect to the apex while preserving path and query. Use Vercel domain redirect settings. Apply the exact apex and `www` DNS values Vercel supplies for the project. Do not guess A, CNAME or verification records. Keep unrelated DNS records intact.
- Wait for propagation. Check the apex and `www` with `dig` and check HTTPS certificate validity and redirects with `curl -I`. Confirm the apex serves a valid certificate before enabling or increasing HSTS. Check the platform's existing HSTS response before adding a policy. Avoid preload or subdomain-wide HSTS until all affected hosts are verified.
- Set Production `APP_ORIGIN=https://palonexsolutions.in`. Both Better Auth configurations use that exact base URL and trusted origin. Verify Secure, HttpOnly cookies, login, callback and logout after domain activation.
- If using an existing no-cost Resend setup for approved manual delivery, verify the sending domain using the SPF/DKIM records and any other records Resend supplies. Review DMARC alignment and deliverability. Use separate restricted keys for preview and production. Keep verification/recovery links free from URL rewriting. The app queues email and only records provider acceptance after a successful send request.
- Both former five-minute schedules are removed. Daily dispatch would miss recovery links that expire after 30 minutes and verification links that expire after one hour. Mail remains queued until an authorized operator runs a worker with processing enabled. Automated delivery is deferred until a suitable no-cost scheduler is available and approved.
- Retention has no scheduler. An operator must verify the database and run `npm run db:prune -- --apply` using the direct maintenance URL. The plain command opens no database connection. See the [operations runbook](PRODUCTION_OPERATIONS_RUNBOOK.md).

## 5. Owner-approved launch

After preview checks and approval, pin the tested commit, establish the Neon recovery point, run production migrations and grants, and provision authorized staff. Configure Production values with mail paused. Deploy behind project protection if available, verify `/api/health/database` and inspect both queues. Confirm backups, HTTPS, production branch and secrets before lifting protection or directing public traffic.

This branch can be used for Preview validation. Reliable public verification, password recovery, enquiry delivery and retention are still operational launch gates. A manual worker check demonstrates delivery for that run only. Public launch remains deferred until the owner verifies a sustainable no-cost execution model. Follow the runbook and keep synthetic test data in Preview.

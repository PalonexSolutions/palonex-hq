# Production environment matrix

Use Node.js 24 and the committed npm lockfile. The build needs no database connection, credentials or mail configuration. Put runtime values in project settings, separated by environment. Never use a `NEXT_PUBLIC_*` prefix for any item below. Values marked nonsecret are still server configuration. Generate independent secrets of at least 32 characters with `openssl rand -hex 32`.

| Variable | Classification | Local | Vercel Preview | Vercel Production |
| --- | --- | --- | --- | --- |
| `DATABASE_URL` | Secret, runtime | Compose loopback URL | Preview-only Neon pooled runtime URL with `sslmode=verify-full` | Production Neon pooled runtime URL with `sslmode=verify-full` |
| `DATABASE_URL_UNPOOLED` | Secret, operator only | Optional loopback override | Direct preview URL on the operator machine | Direct production URL on the operator machine |
| `NEON_RUNTIME_HOST` | Nonsecret, runtime/operator | Unset for Compose | Exact preview pooled hostname, no scheme or port | Exact production pooled hostname, no scheme or port |
| `NEON_PRODUCTION_HOST` | Nonsecret, runtime | Unset | Required production pooled hostname to exclude | Unset |
| `DATABASE_POOL_MAX` | Nonsecret, runtime | Defaults to 3 | Defaults to 2, allowed 1–5 | Defaults to 2, allowed 1–5 |
| `APP_ORIGIN` | Nonsecret, runtime | Exact loopback origin, including port | Exact HTTPS alias for the preview deployment or branch | Exactly `https://palonexsolutions.in` |
| `PUBLIC_AUTH_SECRET` | Secret, runtime | Local-only | Preview-only | Production-only |
| `BETTER_AUTH_SECRET` | Secret, runtime | Local staff only | Preview staff only | Separate production staff secret |
| `ENQUIRY_SIGNING_SECRET` | Secret, runtime | Local-only | Preview-only | Independent production secret |
| `CRON_SECRET` | Secret, runtime | Optional for mock testing | Preview-only for manually triggered test mail | Required for authenticated manual invocation |
| `MAIL_WORKERS_ENABLED` | Nonsecret, runtime | Unset or `false` | `false` by default | `false` by default. Opt in only for an approved manual run |
| `PREVIEW_MAIL_TO` | Private setting, runtime | Unset | Required to enable preview delivery. Use one controlled test mailbox | Unset |
| `RESEND_API_KEY` | Secret, runtime | Omit when using mocks | Separate test key when enabling preview mail | Required when workers are enabled |
| `ENQUIRY_EMAIL_FROM` | Nonsecret, runtime | Optional | Verified test sender | Verified enquiry sender |
| `ENQUIRY_EMAIL_TO` | Private setting, runtime | Optional | Same approved test mailbox as `PREVIEW_MAIL_TO` | Monitored company inbox |
| `IDENTITY_EMAIL_FROM` | Nonsecret, runtime | Optional | Verified test sender | Verified identity sender |
| `ENQUIRY_TRUSTED_IP_HEADER` | Nonsecret, runtime | Optional for a proxy that overwrites it with one IP | Unset. Vercel uses its own forwarded client IP header | Unset. Vercel uses its own forwarded client IP header |
| `ENQUIRY_RETENTION_DAYS` | Nonsecret, maintenance only | Defaults to 365 | Manual operator command when needed | Defaults to 365. Align with the approved privacy policy |
| `VERCEL`, `VERCEL_ENV` | Vercel platform runtime metadata | Unset | Automatically exposed by Vercel | Automatically exposed by Vercel |

No automatic email or retention jobs are configured. Retention requires `npm run db:prune -- --apply` on the operator machine. Secrets for direct connections stay off Vercel. Choose the schema-owner URL for migrations and staff provisioning, and the restricted maintenance URL for pruning. Use separate database role passwords and avoid exporting URLs in logs or shell traces.

For an offline runtime configuration check, load the target's runtime values securely into your process and run `VERCEL_ENV=preview npm run deploy:check` or `VERCEL_ENV=production npm run deploy:check`. The command validates shape, branch pin, independent secrets and selected worker settings. It does not connect to a database or print values. Run database operator commands in a separate shell with Vercel metadata unset. The preview host exclusion depends on configuring the real production endpoint correctly. Confirm both endpoints independently in Neon before deploying.

Test-only values are `TEST_DATABASE_URL` and optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE`. `NEXT_TELEMETRY_DISABLED=1` is optional for build and CI. The [deployment guide](PRODUCTION_DEPLOYMENT_GUIDE.md) covers verification after configuration.

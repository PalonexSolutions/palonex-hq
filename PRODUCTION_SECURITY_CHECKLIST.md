# Release security and smoke checklist

Record a commit, environment, reviewer and date for each completed gate. Use synthetic fixtures only in an isolated database.

## Repository checks

- [x] Node 24, native Next.js entry points and the npm lockfile are retained. The app builds without a database or secrets.
- [x] Runtime and operator connection paths are separate. Hosted connections require pinned Neon endpoints and certificate verification. Preview excludes the configured production endpoint.
- [x] Existing migrations remain immutable. The operator validates checksums and ordered history before applying the transaction.
- [x] Public and staff auth use distinct keys, session records and cookies. Origin validation normalizes neither caller input nor redirects. Hosted production requires the apex HTTPS origin. Preview requires an exact HTTPS origin.
- [x] Parameterized queries, request size limits, revocation, verified email requirements, PostgreSQL quotas and origin checks remain active. No permissive CORS headers are added.
- [x] Private responses use no-store, no-referrer and noindex. Global CSP limits framing, base URL, plugins and form targets while leaving Next.js script and asset policy unchanged. Nosniff and permissions restrictions are enabled. HSTS requires verifying the deployed HTTPS policy first.
- [x] Worker routes require constant-time bearer checks and are paused by default. Preview mail requires an exact test recipient. The runtime role lacks destructive retention rights.
- [ ] Verify the hosted provider controls and cookie behavior in preview. Complete the owner-operated production checks before public launch.

## Preview smoke checks

- [ ] Verify the stable alias, protected access and HTTPS. Confirm the runtime hostname and role using the independent Neon and Vercel settings. Confirm private routes send no-store, noindex and no-referrer. Check the actual hosted headers.
- [ ] Visit the homepage, About, Products and detail routes, PaLoLabs, Opportunities and Engineering Tools. Check sitemap/robots, desktop/mobile layout and both themes.
- [ ] Submit an enquiry with the approved test address. Verify token issuance, persistence, duplicate replay, rate limiting and queue creation. Verify anonymous users cannot access enquiry records.
- [ ] Register with the approved test mailbox. Exercise verification, unverified-login denial, login, cookie attributes, profile edit, password recovery, session revocation and logout. Verify no customer address can be reached.
- [ ] Sign in with a preview staff account. Verify enquiry updates, user suspension/reactivation, audit trail and read-only monitoring. Check anonymous and public accounts cannot use staff routes or APIs directly.
- [ ] Call both workers without and with approved bearer auth. Confirm disabled workers report paused. When preview mail is explicitly enabled, check both queues with the allowlisted mailbox and confirm the provider handles delivery. Test failure and retry in mock integration tests.
- [ ] Verify deployment logs are redacted, readiness succeeds, and local regression and CI checks pass. Turn preview mail back off.

## Production owner gates

- [ ] Verify the actual Vercel Node 24 support, cron plan and schedule. Review approved terms, privacy, retention and staff provisioning.
- [ ] Establish the Neon recovery point and validate the restore plan. Apply and verify migrations using the direct owner URL and separate runtime/maintenance grants. Verify the pooled runtime role against production with non-destructive checks.
- [ ] Configure scoped secrets and provider credentials. Confirm the apex certificate and the `www` redirect. Verify HSTS behavior after HTTPS activation.
- [ ] Verify a protected app deployment, backend readiness, staff sign-in and approved integration tests. Check both queues before enabling mail. Confirm active cron requests are authorized and the external maintenance schedule uses direct credentials.
- [ ] Approve public traffic and mail dispatch. Record status, deployment and settings without exposing credentials. Stop launch if a required provider, DNS, recovery or smoke check fails.

## Known limitations

Live Neon TLS, Vercel behavior, hosted cron, HTTPS, Resend acceptance and DNS require owner verification. Local PostgreSQL and PgBouncer checks validate the repository implementation. Five-minute email jobs require a compatible plan or an external scheduler. Recovery objectives are targets until the owner tests a restore. A full script CSP rollout and broader HSTS policy can be evaluated after observing the deployed site.

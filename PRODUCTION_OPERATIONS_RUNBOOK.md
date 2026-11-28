# Production operations runbook

## Production release and verification

1. Validate the exact release commit locally. Run lint, typecheck, unit and PostgreSQL integration tests, the production build, the built-endpoint registration regressions, and the desktop and mobile browser suite. Use disposable local PostgreSQL, synthetic accounts, and paused mail workers. [Testing guide](TESTING_GUIDE.md)
2. Before authorizing a release, confirm the intended commit on `main`, the Vercel Production target, the canonical `APP_ORIGIN`, and the Production Neon branch pin and restricted runtime role. Confirm `MAIL_WORKERS_ENABLED=false` and that no scheduled or external trigger invokes the workers. Record the recovery timestamp, rollback deployment, owner on duty, and sign-off without copying credentials. [Security checklist](PRODUCTION_SECURITY_CHECKLIST.md)
3. When authorized, release the validated `main` commit through Vercel's Production deployment workflow. In Vercel, confirm the deployed commit, Production target, and Ready status before marking the release verified.
4. Verify the HTTPS registration page on the canonical apex, the `www` redirect, and a 200 with `{"status":"ok"}` from `GET /api/health/database`. Check the deployed commit's runtime logs for new health or registration errors. Keep the Production release smoke checks read-only. Use the local regression suite for registration writes, queue recovery, and verification. The Production health probe checks connectivity and read access only.

## Monitoring and email

- Watch Vercel deployment status, runtime errors and manual worker invocation logs. Use a lightweight HTTPS monitor against `/api/health/database`; 503 signals database connectivity or missing runtime read access. This probe reports no internal details and does not prove write permissions or email delivery.
- In Neon, monitor database connections, pool wait, errors and compute wake-up latency. Keep two connections per warm Vercel process initially. Review connection limits and CPU before changing pool settings.
- In Vercel logs, watch `database.health_failed`, `database.idle_connection_error`, `enquiry.submit_failed`, `admin.login_failed`, `identity.request_failed`, and HTTP status 429 events. Inspect worker summaries `notifications.run_completed` and `identity.mail_run_completed`, failed delivery events, manual authentication failures and 503s.
- The staff notification screen shows enquiry job age and failures. Use the following aggregate-only query from an authorized read session for identity mail. Review the first failed event in Vercel and provider status in Resend. A sent timestamp means the provider accepted the request. Bounces and delivery confirmations require the provider's dashboard.
- Never enable capture of request bodies, query secrets, headers with cookies or authorization, raw database exceptions, emails, provider payloads or bearer links. Keep logs low-cardinality and use opaque IDs for correlation. Paid monitoring is optional and requires owner approval.

```sql
SELECT
  count(*) FILTER (WHERE sent_at IS NULL AND consumed_at IS NULL
    AND expires_at > now() AND attempts < 5) AS pending,
  count(*) FILTER (WHERE sent_at IS NULL AND consumed_at IS NULL
    AND (attempts >= 5 OR expires_at <= now())) AS failed_or_expired,
  now() - min(expires_at - CASE WHEN kind='verify' THEN interval '1 hour' ELSE interval '30 minutes' END)
    FILTER (WHERE sent_at IS NULL AND consumed_at IS NULL AND expires_at > now() AND attempts < 5) AS oldest_pending_age
FROM palonex_private.identity_mail;
```

During approved processing, watch for repeated health failures, terminal identity failures and pending identity mail nearing ten minutes. Each worker claims up to five jobs per invocation, with a two-minute lease and stable provider idempotency key. Provider requests have an eight-second timeout and route execution is capped at 30 seconds. Review queue age during bursts. Steady processing cadence is deferred until a suitable no-cost scheduler is available and approved. Avoid blind replays after provider idempotency expires or after restoring a backup.

## Manual worker procedure

1. Keep `MAIL_WORKERS_ENABLED=false` in Production by default and throughout release verification. Before a separately approved manual Production run, confirm the canonical host, inspect both queues and approve the intended recipients. Skip real delivery when no approved free provider configuration is available.
2. For an approved run, set `MAIL_WORKERS_ENABLED=true` in Production and redeploy its configuration. Load the matching `CRON_SECRET` from secure local tooling. Invoke only the intended endpoint on the exact approved host. For example, with the approved origin in `PALONEX_WORKER_ORIGIN`:

   ```sh
   printf 'header = "Authorization: Bearer %s"\n' "$CRON_SECRET" |
     curl --config - --fail-with-body "$PALONEX_WORKER_ORIGIN/api/internal/notifications"
   ```

   For verification or recovery, use `/api/internal/identity-mail` within the link lifetime. One call processes at most five due jobs and does not bypass leases, backoff or expiry. Review the result before running another batch.
3. Restore `MAIL_WORKERS_ENABLED=false`, redeploy the Production settings and verify an authenticated request returns `{"status":"paused"}`. Anonymous and invalid bearer requests return 401 throughout. Review Vercel project settings for any previously registered jobs or external triggers. Disable stale triggers before enabling manual processing.

## Retention and recovery

- Enquiries and linked notes/audit/notifications default to 365 days, consistent with the current privacy policy. After verifying the target and recovery point, the restricted direct maintenance role can run `npm run db:prune -- --apply` manually to remove expired sessions and link records and old rate windows. With no `--apply`, the command opens no database connection. Track manual runs against the retention policy and defer public launch if the cadence cannot be maintained. Changing enquiry retention requires updating the approved policy and considering backup retention. Keep account/audit retention review separate from enquiry pruning.
- In Neon, confirm the actual branch restore and point-in-time recovery window for the selected plan. Plans and retention settings vary. Record the configured window, owner access and a validated recovery point. Target **RPO ≤ 1 hour** and **RTO ≤ 4 hours**. These are planning targets and depend on the selected plan and a successful restore drill.
- Before schema changes, record a recovery timestamp and create an approved recovery point according to Neon features. If policy calls for a logical backup, run a compatible `pg_dump --format=custom --schema=palonex_private --no-owner --no-privileges` against the direct owner connection using protected client configuration. Store the dump encrypted with tightly scoped access and an expiry date. It contains private data, password hashes and session material. Preserve separate role/grant and provider configuration documentation.
- Practice logical restore in a disposable local PostgreSQL database with mail paused and restricted access. For a logical dump, restore into an empty isolated database with `pg_restore --exit-on-error --no-owner --no-privileges`, apply scoped grants, then run `npm run db:status` and read-only counters. Use synthetic data for routine restore drills. Handle any authorized customer backup under the recovery controls above. Record time to restore and verify an approved smoke test before updating the recovery targets.
- **App rollback:** use Vercel's previous deployment or redeploy the last known compatible commit. Verify schema compatibility first. This does not reverse a database migration or undo writes.
- **Database recovery:** stop new writes and pause mail, identify the affected time and branch, restore to a separate branch, then compare integrity and migration state. Decide which writes must be reconciled before changing any environment URL or branch pin. Reapply scoped credentials, and verify application compatibility and queues before cutover. Live PITR rollback and public traffic changes require owner approval.

## Registration 503

Filter Vercel Runtime Logs for `identity.registration_failed` on the affected deployment and `POST /api/identity/register`. Record the stage, HTTP status, opaque request ID, and any configuration issue, SQLSTATE, connection code, or Better Auth status. The request ID identifies the log entry. It is generated by the application.

| Stage | What to check |
| --- | --- |
| `origin_validation` | A 403 means the request origin failed the exact comparison. Confirm that the browser reaches the canonical apex before rendering or submitting the form. A 503 with an origin or metadata issue means the deployment configuration failed validation. |
| `auth_initialization` | Check the Production public identity secret and its separation from the staff secret. |
| `database_initialization` | Check the Production pooled runtime URL, TLS parameters, Neon host pin and pool size. Connection establishment is lazy, so network or database authentication errors can first appear at `rate_limit`. |
| `rate_limit` | Check connectivity and the scoped grant for the rate-limit upsert. |
| `signup` | Check the Better Auth status and SQLSTATE for user and credential operations. |
| `duplicate_check` | Check runtime ability to read the identity user table. |
| `verification_queue` | Check the user lookup and verification queue transaction. A failed queue can leave an unverified account because signup and queueing use separate transactions. |

SQLSTATE `42501` identifies an insufficient privilege. Inspect the exact targeted branch and runtime role before changing grants. Reproduce registration failures against the built app and disposable local PostgreSQL. In Production, use the read-only health check and inspect existing runtime logs with mail paused. Once the queue issue is resolved, an affected user can request a new link from the sign-in page. Delivery still requires an approved manual worker run within the link lifetime.

## Incident checklist

1. Identify the deployment, branch, timestamp and failure class. Confirm affected routes and capture safe event IDs and aggregate counts.
2. If mail is at risk, pause `MAIL_WORKERS_ENABLED` and redeploy the scoped configuration, or revoke the manual invocation secret temporarily. Inspect the backlog and expiry before reactivating.
3. If traffic is at risk, restrict access and roll back through Vercel if the previous release is schema-compatible. Keep migration state and writes intact. Escalate data recovery to the owner.
4. For leaked credentials, rotate in only the affected environment, redeploy and revoke old credentials after confirming the new role and connection. Rotating public auth invalidates public cookies and pending recovery/verification links. Rotating staff auth invalidates staff cookies. Rotating the enquiry signing secret invalidates outstanding form tokens. Rotating the worker bearer secret requires updating the approved operator configuration. Rotate Resend and Neon passwords independently, and review jobs and connection activity.
5. For compromised staff credentials, use the direct operator connection to `npm run admin:staff -- disable <staff-email>` and verify session revocation. Provision an approved replacement identity through the documented hidden password prompt. Review audit events and retain the old administrator ID for correlation.
6. Verify Production health and HTTPS before reopening access. Validate registration writes, sessions, and queue behavior locally. Record the resolution with recovery metrics and approved follow-up.

Provider documentation for owner verification includes [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Neon branching and restore](https://neon.com/docs/introduction/branch-restore), and [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).

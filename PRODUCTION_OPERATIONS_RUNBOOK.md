# Production operations runbook

## Before traffic

Record the deployed commit, Vercel environment, Neon project and branch, approved mail state, recovery timestamp and owner on duty. Keep the runbook and sealed credentials accessible to the owner. Use the [deployment guide](PRODUCTION_DEPLOYMENT_GUIDE.md) and [security checklist](PRODUCTION_SECURITY_CHECKLIST.md) to record sign-off.

## Monitoring and email

- Watch Vercel deployment status, runtime errors and cron invocation logs. Use a lightweight HTTPS monitor against `/api/health/database`; 503 signals database connectivity or missing runtime read access. This probe reports no internal details and does not prove write permissions or email delivery.
- In Neon, monitor database connections, pool wait, errors and compute wake-up latency. Keep two connections per warm Vercel process initially. Review connection limits and CPU before changing pool settings.
- In Vercel logs, watch `database.health_failed`, `database.idle_connection_error`, `enquiry.submit_failed`, `admin.login_failed`, `identity.request_failed`, and HTTP status 429 events. Inspect worker summaries `notifications.run_completed` and `identity.mail_run_completed`, failed delivery events, cron authentication failures, 503s and missed schedules.
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

Start with alerts for repeated health failures, missing consecutive cron runs, any terminal identity failures and pending identity mail nearing ten minutes. Each worker claims up to five jobs per invocation, with a two-minute lease and stable provider idempotency key. Provider requests have an eight-second timeout and route execution is capped at 30 seconds. Review queue age during bursts. Increase cadence only on a supported plan and verify capacity. Avoid blind replays after provider idempotency expires or after restoring a backup.

## Retention and recovery

- Enquiries and linked notes/audit/notifications default to 365 days, consistent with the current privacy policy. A direct maintenance role runs `npm run db:prune` daily to clean expired sessions and link records and old rate windows. Changing enquiry retention requires updating the approved policy and considering backup retention. Keep account/audit retention review separate from enquiry pruning.
- In Neon, confirm the actual branch restore and point-in-time recovery window for the selected plan. Plans and retention settings vary. Record the configured window, owner access and a validated recovery point. Target **RPO ≤ 1 hour** and **RTO ≤ 4 hours**. These are planning targets and depend on the selected plan and a successful restore drill.
- Before schema changes, record a recovery timestamp and create an approved recovery point according to Neon features. If policy calls for a logical backup, run a compatible `pg_dump --format=custom --schema=palonex_private --no-owner --no-privileges` against the direct owner connection using protected client configuration. Store the dump encrypted with tightly scoped access and an expiry date. It contains private data, password hashes and session material. Preserve separate role/grant and provider configuration documentation.
- Practice restore in an isolated branch with mail paused and restricted access. For a logical dump, restore into an empty isolated database with `pg_restore --exit-on-error --no-owner --no-privileges`, apply scoped grants, then run `npm run db:status` and read-only counters. Keep restored customer data out of ordinary preview environments. Record time to restore and verify an approved smoke test before updating the recovery targets.
- **App rollback:** use Vercel's previous deployment or redeploy the last known compatible commit. Verify schema compatibility first. This does not reverse a database migration or undo writes.
- **Database recovery:** stop new writes and pause mail, identify the affected time and branch, restore to a separate branch, then compare integrity and migration state. Decide which writes must be reconciled before changing any environment URL or branch pin. Reapply scoped credentials, and verify application compatibility and queues before cutover. Live PITR rollback and public traffic changes require owner approval.

## Incident checklist

1. Identify the deployment, branch, timestamp and failure class. Confirm affected routes and capture safe event IDs and aggregate counts.
2. If mail is at risk, pause `MAIL_WORKERS_ENABLED` and redeploy the scoped configuration, or disable the scheduler and revoke its secret temporarily. Inspect the backlog and expiry before reactivating.
3. If traffic is at risk, restrict access and roll back through Vercel if the previous release is schema-compatible. Keep migration state and writes intact. Escalate data recovery to the owner.
4. For leaked credentials, rotate in only the affected environment, redeploy and revoke old credentials after confirming the new role and connection. Rotating public auth invalidates public cookies and pending recovery/verification links. Rotating staff auth invalidates staff cookies. Rotating the enquiry signing secret invalidates outstanding form tokens. Rotating the cron secret requires updating the scheduler. Rotate Resend and Neon passwords independently, and review jobs and connection activity.
5. For compromised staff credentials, use the direct operator connection to `npm run admin:staff -- disable <staff-email>` and verify session revocation. Provision an approved replacement identity through the documented hidden password prompt. Review audit events and retain the old administrator ID for correlation.
6. Verify health, read/write smoke checks, sessions, queue behavior and HTTPS before reopening access. Record the resolution with recovery metrics and approved follow-up.

Provider documentation for owner verification includes [Vercel Cron](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Neon branching and restore](https://neon.com/docs/introduction/branch-restore), and [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction).

# PaLoNex HQ administration

Use `/admin` for the overview, `/admin/enquiries` for the work queue, and `/admin/notifications` for delivery monitoring.

## Authentication and access

Better Auth handles password hashing, credential verification and signed session cookies. PostgreSQL stores the session and authorized staff record. The server checks both on every protected page and API request. Sessions expire after eight hours without renewal. Logout deletes the database session. Disabling an administrator revokes all their sessions. Production cookies are Secure, HttpOnly and SameSite=Strict. Plain HTTP sign-in is allowed only on loopback for local development.

Provision staff from a trusted workstation or maintenance environment using the CLI. There is no public registration, hosted identity provider, browser database connection, public password reset or generic Better Auth endpoint. Keep passwords in a staff password manager and handle resets administratively. This release uses passwords as the only authentication factor.

All mutations and the private search API require the exact configured origin. Request bodies are JSON, size-limited and validated with Zod. The login endpoint applies PostgreSQL-backed quotas per account and network, plus a global quota. A deployment proxy must overwrite any configured trusted client-IP header. Private routes disable caching, indexing and referrer sharing. Search terms travel in POST bodies to avoid placing names or email addresses in URLs. Configure infrastructure logs to omit private request bodies and cookies.

Status updates and notes are stored atomically with an audit record. Audit changes have no application endpoint. A least-privilege production role can only read and append audit and note records. Both are removed under the existing enquiry retention policy. Notification monitoring is read-only, and “accepted” means the provider accepted a send request. Delivery attempts remain under the existing scheduled worker.

## Local setup

From the repository root:

```sh
npm ci
docker compose up -d --wait
cp -n .env.example .env.local
```

In `.env.local`, set `APP_ORIGIN=http://localhost:3000`, ensure `DATABASE_URL` points to the local database, and set separate random `ENQUIRY_SIGNING_SECRET` and `BETTER_AUTH_SECRET` values using `openssl rand -hex 32`. Keep the file out of Git.

```sh
npm run db:migrate
read -rsp 'New administrator password: ' PALONEX_STAFF_PASSWORD
printf '\n'
printf '%s' "$PALONEX_STAFF_PASSWORD" | npm run admin:staff -- create staff@example.test "Local Administrator"
unset PALONEX_STAFF_PASSWORD
npm run dev
```

Use a unique password of 14 to 128 characters. Visit `http://localhost:3000/admin` and sign in with the provisioned staff account. Replace the example email with the intended staff address. To revoke access, run `npm run admin:staff -- disable staff@example.test` using the maintenance database connection.

## Production

1. Follow [Backend setup](BACKEND_SETUP.md) for verified TLS database access and `APP_ORIGIN`. Use an HTTPS origin and configure `BETTER_AUTH_SECRET` independently in the hosting secret store. Changing this secret invalidates existing browser sessions.
2. Run `npm run db:migrate` from the migration owner connection. Migration 002 adds the private identity, session, staff authorization, throttle, note and audit tables. Keep `palonex_private` outside any exposed database schema list.
3. Extend the existing runtime grants as shown below. Run provisioning and access revocation as a separate maintenance role or the schema owner. The web runtime does not provision staff.
4. Verify sign-in, sign-out, read access and audited status changes on the HTTPS deployment before granting operational access. Configure the existing email worker separately.

```sql
GRANT SELECT ON palonex_private.admin_user, palonex_private.admin_account, palonex_private.admin_staff TO palonex_runtime;
GRANT SELECT, INSERT, DELETE ON palonex_private.admin_session TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.admin_login_limits TO palonex_runtime;
GRANT SELECT, INSERT ON palonex_private.enquiry_notes, palonex_private.enquiry_audit TO palonex_runtime;
GRANT USAGE ON SEQUENCE palonex_private.enquiry_audit_id_seq TO palonex_runtime;
```

The daily `npm run db:prune` job also removes expired sessions and login-rate windows older than two days. Grant the maintenance role the necessary permissions on both tables. Monitor unexpected login throttling and failed queue deliveries. An authenticated administrator can review all enquiries. Scoped roles, MFA and self-service credential recovery remain future work.

## Tests

Use a dedicated empty local PostgreSQL database. These tests create synthetic staff and enquiry fixtures and do not send real emails.

```sh
export PALONEX_DB_PORT=55435
docker compose -p palonex-admin-test up -d --wait
export TEST_DATABASE_URL=postgresql://palonex@127.0.0.1:55435/palonex
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npx playwright install chromium
DATABASE_URL="$TEST_DATABASE_URL" APP_ORIGIN=http://127.0.0.1:3100 \
  ENQUIRY_SIGNING_SECRET="$(openssl rand -hex 32)" BETTER_AUTH_SECRET="$(openssl rand -hex 32)" npm test
```

If system Chromium is available, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path instead of installing the Playwright browser.

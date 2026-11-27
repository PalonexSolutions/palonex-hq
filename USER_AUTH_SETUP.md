# Public account setup

1. Run `npm ci` and `docker compose up -d --wait`.
2. Copy `.env.example` to `.env.local` if it does not exist. Set the exact browser `APP_ORIGIN` and the local `DATABASE_URL`. Generate an independent `PUBLIC_AUTH_SECRET` with `openssl rand -hex 32`. Keep it distinct from `BETTER_AUTH_SECRET` and the other secrets.
3. Run `npm run db:migrate` and `npm run dev`. Open `http://localhost:3000/register` when using the default origin.
4. To deliver real verification and recovery messages, configure `RESEND_API_KEY`, `IDENTITY_EMAIL_FROM` as a verified sender, and `CRON_SECRET`. Schedule an HTTPS GET to `/api/internal/identity-mail` every minute or as frequently as your hosting plan supports, using `Authorization: Bearer <CRON_SECRET>`. Keep the existing enquiry notification schedule separate. Disable URL rewriting for identity emails, and check that fragments survive in received links.
5. For production, use HTTPS, verified TLS PostgreSQL, the runtime grants below, and a deployment smoke test with an approved test mailbox. Keep off-platform SQL clients and PostgREST from exposing `palonex_private`.

The web app acknowledges queuing. Email delivery requires the configured worker and provider. Rotating `PUBLIC_AUTH_SECRET` invalidates public cookies and unused links. Ask users to request new links after rotating it. The separate staff secret and sessions are unaffected. The existing daily prune job removes expired identity sessions, link records, verification values and rate windows. Grant the maintenance role the necessary cleanup permissions.

## Runtime database grants

Run these in addition to the [backend grants](BACKEND_SETUP.md) and [staff grants](ADMIN_SETUP.md). The runtime role can read product role assignments. Only maintenance or a future protected provisioning flow can grant them.

```sql
GRANT SELECT, INSERT ON palonex_private.identity_user TO palonex_runtime;
GRANT UPDATE (name, "updatedAt", "emailVerified", status) ON palonex_private.identity_user TO palonex_runtime;
GRANT SELECT, INSERT ON palonex_private.identity_account TO palonex_runtime;
GRANT UPDATE (password, "updatedAt") ON palonex_private.identity_account TO palonex_runtime;
GRANT SELECT, INSERT, DELETE ON palonex_private.identity_session, palonex_private.identity_verification TO palonex_runtime;
GRANT SELECT ON palonex_private.identity_role TO palonex_runtime;
GRANT SELECT, INSERT, UPDATE ON palonex_private.identity_rate, palonex_private.identity_mail TO palonex_runtime;
GRANT SELECT, INSERT ON palonex_private.identity_audit TO palonex_runtime;
GRANT USAGE ON SEQUENCE palonex_private.identity_audit_id_seq TO palonex_runtime;
```

## Test without sending email

Use a fresh PostgreSQL instance for tests. The integration test captures messages from the mock provider in memory. Playwright reads only synthetic account links from the isolated database. No external mail credentials are needed.

```sh
export PALONEX_DB_PORT=55436
docker compose -p palonex-identity-test up -d --wait
export TEST_DATABASE_URL=postgresql://palonex@127.0.0.1:55436/palonex
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
npx playwright install chromium
DATABASE_URL="$TEST_DATABASE_URL" APP_ORIGIN=http://127.0.0.1:3100 \
  PUBLIC_AUTH_SECRET="$(openssl rand -hex 32)" BETTER_AUTH_SECRET="$(openssl rand -hex 32)" \
  ENQUIRY_SIGNING_SECRET="$(openssl rand -hex 32)" npm test
```

The testing helper operates on synthetic `@example.test` accounts in a local test database. Do not use it for real accounts. See [identity architecture](IDENTITY_ARCHITECTURE.md) for access boundaries, risks and future integration.

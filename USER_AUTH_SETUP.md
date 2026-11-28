# Public account setup

1. Run `npm ci` and `docker compose up -d --wait`.
2. Copy `.env.example` to `.env.local` if it does not exist. Set the exact browser `APP_ORIGIN` and the local `DATABASE_URL`. Generate an independent `PUBLIC_AUTH_SECRET` with `openssl rand -hex 32`. Keep it distinct from `BETTER_AUTH_SECRET` and the other secrets.
3. Run `npm run db:migrate` and `npm run dev`. Open `http://localhost:3000/register` when using the default origin.
4. To deliver real verification and recovery messages, configure `RESEND_API_KEY`, `IDENTITY_EMAIL_FROM` as a verified sender, and `CRON_SECRET`. Use the approved manual procedure in the [operations runbook](PRODUCTION_OPERATIONS_RUNBOOK.md) for `/api/internal/identity-mail`. The Hobby configuration schedules no email. Daily delivery would miss verification and recovery link expiry. Disable URL rewriting for identity emails, and check that fragments survive in received links.
5. For production, use HTTPS, verified TLS PostgreSQL, the runtime grants below, and a deployment smoke test with an approved test mailbox. Keep off-platform SQL clients and PostgREST from exposing `palonex_private`.

The web app acknowledges queuing. Email delivery requires the configured worker and provider. Rotating `PUBLIC_AUTH_SECRET` invalidates public cookies and unused links. Ask users to request new links after rotating it. The separate staff secret and sessions are unaffected. The manual `npm run db:prune -- --apply` command removes expired identity sessions, link records, verification values and rate windows. Grant the maintenance role the necessary cleanup permissions.

## Production

Use the [production deployment guide](PRODUCTION_DEPLOYMENT_GUIDE.md) and [environment matrix](PRODUCTION_ENVIRONMENT_MATRIX.md) for Neon, Vercel, grants and mail activation. A single reviewed `db/ops/grants.sql` file applies runtime and maintenance access. The runtime can read product role assignments. Only an authorized maintenance or future provisioning workflow may grant them. Local mail delivery also requires `MAIL_WORKERS_ENABLED=true`.

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

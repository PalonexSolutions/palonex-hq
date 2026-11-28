# Testing guide

Run the following from the repository root. All suites run locally. Browser tests serve the production build on loopback, and database-backed tests use disposable local PostgreSQL with synthetic data and paused mail workers.

```sh
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Playwright starts the production build on port 3100 and tests desktop Chrome and a mobile viewport. If Chromium is already installed, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its path before running the suite. The current cases cover the homepage, ecosystem link, mobile overflow, product navigation and the enquiry section.

Run `npm run test:unit` on Node 24 for the standalone processing suite. It exercises malformed, empty, Unicode, boundary and large inputs across all eight tools. The Playwright suite exercises the actual workspaces, including local file hashing, downloads, clipboard, invalid-input feedback, accessible labels, keyboard activation and mobile navigation.

## Backend tests

Start a separate Compose project and migrate its empty database before running tests:

```sh
export PALONEX_DB_PORT=55433
docker compose -p palonex-backend-test up -d --wait
export TEST_DATABASE_URL=postgresql://palonex@127.0.0.1:55433/palonex
DATABASE_URL="$TEST_DATABASE_URL" npm run db:migrate
npm run test:unit
npm run test:integration
npm run build
DATABASE_URL="$TEST_DATABASE_URL" APP_ORIGIN=http://127.0.0.1:3100 \
  MAIL_WORKERS_ENABLED=false ENQUIRY_SIGNING_SECRET="$(openssl rand -hex 32)" npm test
```

The integration suite tests database writes and rollbacks, concurrency, filtering, status transitions and the email outbox with a mock provider. The browser suite uses PostgreSQL for submission tests when `TEST_DATABASE_URL` is present. Keep this database separate from development and production data.

## Registration database failure and recovery

Run these tests on a disposable local PostgreSQL instance with port 3101 free for the built app. The tests temporarily revoke individual runtime INSERT grants and restore them in `finally`. Use a fresh container and never point the suite at a database shared with another test run.

```sh
docker run -d --rm --name palonex-registration-regression -p 127.0.0.1:55441:5432 \
  -e POSTGRES_USER=palonex -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=palonex_registration_regression postgres:17
# Wait for pg_isready to report accepting connections.
docker exec palonex-registration-regression pg_isready -h 127.0.0.1 -U palonex -d palonex_registration_regression
export REGISTRATION_TEST_DATABASE_URL=postgresql://palonex@127.0.0.1:55441/palonex_registration_regression
DATABASE_URL_UNPOOLED="$REGISTRATION_TEST_DATABASE_URL" npm run db:migrate
docker exec palonex-registration-regression psql -U palonex -d palonex_registration_regression \
  -v ON_ERROR_STOP=1 -c 'CREATE ROLE palonex_runtime LOGIN; CREATE ROLE palonex_maintenance LOGIN;'
docker exec -i palonex-registration-regression psql -U palonex -d palonex_registration_regression \
  -v ON_ERROR_STOP=1 < db/ops/grants.sql
npm run build
npm run test:registration-endpoint
docker stop palonex-registration-regression
```

The suite starts Next.js in production mode with the restricted runtime role and paused mail workers. It submits the verification link from the local encrypted fixture directly to the verification endpoint.

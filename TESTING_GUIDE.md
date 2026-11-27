# Testing guide

Run the following from the repository root.

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
  ENQUIRY_SIGNING_SECRET="$(openssl rand -hex 32)" npm test
```

The integration suite tests database writes and rollbacks, concurrency, filtering, status transitions and the email outbox with a mock provider. The browser suite uses PostgreSQL for submission tests when `TEST_DATABASE_URL` is present. Keep this database separate from development and production data.

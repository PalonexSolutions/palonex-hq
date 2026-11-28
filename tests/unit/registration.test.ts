import assert from "node:assert/strict";
import { test } from "node:test";
import pg from "pg";
import { getDatabase } from "../../lib/server/database.ts";
import { registerIdentity } from "../../lib/server/register-identity.ts";
import { captureRegistrationAuthError, diagnoseRegistration } from "../../lib/server/registration-diagnostics.ts";

const body = { name: "Fixture user", email: "private@example.test", password: "Fixture-private-passphrase-182",
  confirmation: "Fixture-private-passphrase-182", consent: true, website: "" };
const origin = "https://palonexsolutions.in";
const request = (value = origin) => new Request(origin + "/api/identity/register", {
  method: "POST", headers: { Origin: value, "Content-Type": "application/json" }, body: JSON.stringify(body),
});

test("registration diagnoses origin, secrets, database initialization and connection without leaking internals", async t => {
  const logs: string[] = [];
  t.mock.method(console, "error", (value: string) => logs.push(value));
  t.mock.method(console, "warn", (value: string) => logs.push(value));
  process.env.APP_ORIGIN = origin;
  process.env.VERCEL_ENV = "production";
  const blocked = await registerIdentity(request("https://www.palonexsolutions.in"));
  assert.equal(blocked.status, 403);
  assert.equal(JSON.parse(logs.at(-1)!).stage, "origin_validation");

  const unavailable = async (stage: string, issue?: string) => {
    const result = await registerIdentity(request());
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { error: "Service temporarily unavailable. Please try again." });
    const log = JSON.parse(logs.at(-1)!);
    assert.equal(log.stage, stage);
    if (issue) assert.equal(log.configurationIssue, issue);
    return log;
  };
  delete process.env.PUBLIC_AUTH_SECRET;
  await unavailable("auth_initialization", "public_auth_secret_missing");
  process.env.PUBLIC_AUTH_SECRET = "too-short";
  await unavailable("auth_initialization", "public_auth_secret_short");
  process.env.PUBLIC_AUTH_SECRET = process.env.BETTER_AUTH_SECRET = "synthetic-shared-secret-".repeat(3);
  await unavailable("auth_initialization", "public_auth_secret_shared");
  delete process.env.BETTER_AUTH_SECRET;
  delete process.env.DATABASE_URL;
  await unavailable("database_initialization", "database_url_invalid");
  const host = "ep-fixture-pooler.region.aws.neon.tech";
  process.env.NEON_RUNTIME_HOST = host;
  process.env.DATABASE_URL = `postgresql://palonex_runtime@${host}/neondb?sslmode=require`;
  await unavailable("database_initialization", "database_tls_or_parameters_invalid");
  delete process.env.VERCEL_ENV;
  process.env.DATABASE_URL = "postgresql://fixture@127.0.0.1:1/unavailable";
  try {
    const log = await unavailable("rate_limit");
    assert.equal(log.connectionCode, "ECONNREFUSED");
  } finally { await getDatabase().end(); }

  for (const secret of [body.email, body.password, host, process.env.DATABASE_URL, process.env.PUBLIC_AUTH_SECRET]) {
    assert.ok(!logs.join("\n").includes(secret));
  }
});

test("diagnostics preserve safe SQLSTATE and Better Auth status without logging messages or metadata", async t => {
  const logs: string[] = [];
  t.mock.method(console, "error", (value: string) => logs.push(value));
  const privateText = "fixture-password-and-verification-link";
  for (const stage of ["rate_limit", "signup", "duplicate_check", "verification_queue"] as const) {
    const result = await diagnoseRegistration(async (next, status) => {
      next(stage);
      const error = new pg.DatabaseError(privateText, 0, "error");
      error.code = "42501";
      if (stage === "signup" || stage === "verification_queue") {
        captureRegistrationAuthError({ password: privateText }, error);
        status(stage === "signup" ? 422 : 500);
        throw new Error(privateText);
      }
      throw error;
    });
    assert.equal(result.status, 503);
    assert.ok(!(await result.text()).includes(privateText));
    const log = JSON.parse(logs.at(-1)!);
    assert.equal(log.stage, stage);
    assert.equal(log.sqlState, "42501");
    assert.equal(log.authStatus, stage === "signup" ? 422 : stage === "verification_queue" ? 500 : undefined);
    assert.match(log.requestId, /^[0-9a-f-]{36}$/);
  }
  assert.ok(!logs.join("\n").includes(privateText));
});

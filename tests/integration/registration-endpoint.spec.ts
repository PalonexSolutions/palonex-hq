import assert from "node:assert/strict";
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import pg from "pg";

const fixture = new URL(process.env.REGISTRATION_TEST_DATABASE_URL ?? "postgresql://127.0.0.1/invalid");
assert.ok(
  fixture.protocol === "postgresql:" && fixture.hostname === "127.0.0.1" && fixture.port
    && fixture.pathname === "/palonex_registration_regression" && !fixture.search && !fixture.hash
    && fixture.username === "palonex",
  "Supply the dedicated local palonex_registration_regression database as palonex.",
);

const origin = "http://127.0.0.1:3101";
const secret = randomUUID();
const staffSecret = randomUUID();
const fixtureToken = randomUUID();
const runtime = new URL(fixture);
runtime.username = "palonex_runtime";
runtime.password = `fixture-db-password-${randomUUID()}`;
const owner = new pg.Client({ connectionString: fixture.href });
let server: ChildProcess | undefined;
let output = "";

before(async () => {
  await owner.connect();
  const role = new pg.Client({ connectionString: runtime.href });
  await role.connect();
  try {
    const { rows } = await role.query(`
      SELECT current_user = 'palonex_runtime' AND NOT (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
        AND has_table_privilege('palonex_private.identity_user', 'INSERT')
        AND has_table_privilege('palonex_private.identity_mail', 'INSERT') AS restricted
      FROM pg_roles WHERE rolname = current_user`);
    assert.equal(rows[0]?.restricted, true);
  } finally {
    await role.end();
  }

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3101"], {
    env: {
      ...process.env,
      NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1",
      APP_ORIGIN: origin, PUBLIC_AUTH_SECRET: secret, BETTER_AUTH_SECRET: staffSecret,
      DATABASE_URL: runtime.href, DATABASE_URL_UNPOOLED: "", DATABASE_POOL_MAX: "2",
      VERCEL: "", VERCEL_ENV: "", NEON_RUNTIME_HOST: "", MAIL_WORKERS_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) stream?.on("data", chunk => { output += chunk.toString(); });
  await waitFor(() => output.includes("Ready in"), "Next.js startup");
  const health = await fetch(origin + "/api/health/database", { signal: AbortSignal.timeout(5000) });
  assert.equal(health.status, 200);
});

after(async () => {
  try {
    if (server?.exitCode === null && server.signalCode === null) {
      const exited = once(server, "exit");
      server.kill();
      await exited;
    }
  } finally {
    await owner.end();
  }
});

async function waitFor<T>(read: () => T | undefined, description: string): Promise<T> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && server?.exitCode === null) {
    const result = read();
    if (result) return result;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${description}.`);
}

function post(operation: string, body: object) {
  return fetch(origin + "/api/identity/" + operation, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", Cookie: `fixture_token=${fixtureToken}` },
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
}

function registration() {
  const email = `${randomUUID()}@example.test`;
  const password = `Fixture passphrase ${randomUUID()}`;
  return { email, password, confirmation: password, name: "Registration Fixture", consent: true, website: "" };
}

async function withoutInsert(table: "identity_user" | "identity_mail", run: () => Promise<void>) {
  await owner.query(`REVOKE INSERT ON palonex_private.${table} FROM palonex_runtime`);
  try {
    await run();
  } finally {
    await owner.query(`GRANT INSERT ON palonex_private.${table} TO palonex_runtime`);
  }
}

async function expectRegistrationFailure(input: ReturnType<typeof registration>, stage: string, authStatus?: number) {
  const start = output.length;
  const response = await post("register", input);
  const body = await response.text();
  assert.equal(response.status, 503);
  const line = await waitFor(
    () => output.slice(start).split(/\r?\n/).slice(0, -1).find(entry => entry.includes('"event":"identity.registration_failed"')),
    "the structured registration diagnostic",
  );
  for (const privateValue of [input.email, input.password, secret, staffSecret, fixtureToken, runtime.password, runtime.href, fixture.href,
    "permission denied", "identity_user", "identity_mail"]) {
    assert.ok(!body.includes(privateValue) && !output.includes(privateValue), "Client and server output must redact private details.");
  }
  assert.deepEqual(JSON.parse(body), { error: "Service temporarily unavailable. Please try again." });
  const event = JSON.parse(line);
  assert.equal(event.stage, stage);
  assert.equal(event.errorName, "DatabaseError");
  assert.equal(event.sqlState, "42501");
  assert.equal(event.authStatus, authStatus);
  assert.equal(event.status, 503);
}

test("the built endpoint logs SQLSTATE when Better Auth masks a denied user INSERT as 422", async () => {
  const input = registration();
  await withoutInsert("identity_user", () => expectRegistrationFailure(input, "signup", 422));
  const result = await owner.query("SELECT id FROM palonex_private.identity_user WHERE email=$1", [input.email]);
  assert.equal(result.rowCount, 0);
});

test("resend repairs a failed verification enqueue for the original account", async () => {
  const input = registration();
  await withoutInsert("identity_mail", () => expectRegistrationFailure(input, "verification_queue"));

  const users = () => owner.query('SELECT id,"emailVerified" FROM palonex_private.identity_user WHERE email=$1', [input.email]);
  const before = (await users()).rows;
  assert.equal(before.length, 1);
  assert.equal(before[0].emailVerified, false);
  const id = before[0].id;
  const credentials = () => owner.query(
    `SELECT id FROM palonex_private.identity_account WHERE "userId"=$1 AND "providerId"='credential'`, [id],
  );
  const originalCredentials = await credentials();
  assert.equal(originalCredentials.rowCount, 1);
  const jobs = () => owner.query(`
    SELECT id, consumed_at IS NULL AND payload IS NOT NULL AND expires_at > now()
      AND sent_at IS NULL AND attempts = 0 AND available_at <= now() AS usable
    FROM palonex_private.identity_mail WHERE user_id=$1 AND kind='verify'`, [id]);
  assert.equal((await jobs()).rowCount, 0);

  const resend = await post("resend", { email: input.email });
  assert.equal(resend.status, 202);
  assert.deepEqual((await users()).rows, before);
  assert.deepEqual((await credentials()).rows, originalCredentials.rows);
  const current = await jobs();
  assert.equal(current.rowCount, 1);
  assert.equal(current.rows[0].usable, true);

  const { stdout } = await promisify(execFile)(process.execPath, [
    "--conditions=react-server", "tests/helpers/read-identity-test-link.ts", input.email, "verify",
  ], { env: { ...process.env, APP_ORIGIN: origin, PUBLIC_AUTH_SECRET: secret, TEST_DATABASE_URL: fixture.href,
    VERCEL: "", VERCEL_ENV: "" } });
  const link = new URL(stdout).hash.slice(1);
  assert.ok(/^[A-Za-z0-9_-]{43}$/.test(link), "Expected an opaque verification fixture token.");
  const verification = await post("verify", { link });
  assert.equal(verification.status, 200);
  assert.ok(!(await verification.text()).includes(link) && !output.includes(link), "Verification must not echo the fixture token.");
  assert.deepEqual((await users()).rows, [{ id, emailVerified: true }]);
  assert.equal((await jobs()).rows[0].usable, false);
});

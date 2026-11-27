import assert from "node:assert/strict";
import { test } from "node:test";
import { applicationOrigin, operatorDatabaseUrl, runtimeDatabaseUrl, trustedClientIp } from "../../lib/server/deployment.ts";
import { authorizeWorker, restrictPreviewMail } from "../../lib/server/worker.ts";

const productionHost = "ep-production-pooler.region.aws.neon.tech";
const previewHost = "ep-preview-pooler.region.aws.neon.tech";
const url = (host: string, query = "sslmode=verify-full") => `postgresql://palonex_runtime@${host}/palonex?${query}`;

test("hosted origins explicitly separate the canonical production domain and HTTPS preview", () => {
  assert.deepEqual(applicationOrigin({ APP_ORIGIN: "https://palonexsolutions.in", VERCEL_ENV: "production" }),
    { origin: "https://palonexsolutions.in", secure: true });
  assert.throws(() => applicationOrigin({ APP_ORIGIN: "http://localhost:3000", VERCEL_ENV: "production" }));
  assert.throws(() => applicationOrigin({ APP_ORIGIN: "https://www.palonexsolutions.in", VERCEL_ENV: "production" }));
  assert.throws(() => applicationOrigin({ APP_ORIGIN: "https://palonexsolutions.in", VERCEL_ENV: "preview" }));
  assert.throws(() => applicationOrigin({ APP_ORIGIN: "https://localhost", VERCEL_ENV: "preview" }));
  assert.throws(() => applicationOrigin({ APP_ORIGIN: "https://preview.example.test", VERCEL: "1" }));
  assert.equal(applicationOrigin({ APP_ORIGIN: "https://preview.example.test", VERCEL_ENV: "preview" }).secure, true);
  assert.equal(applicationOrigin({ APP_ORIGIN: "http://127.0.0.1:3100" }).secure, false);
});

test("preview is pinned to its pooled endpoint and rejects the production endpoint and weaker TLS", () => {
  const preview = { VERCEL_ENV: "preview", NEON_RUNTIME_HOST: previewHost, NEON_PRODUCTION_HOST: productionHost, DATABASE_URL: url(previewHost) };
  assert.equal(runtimeDatabaseUrl(preview), preview.DATABASE_URL);
  for (const changes of [
    { NEON_PRODUCTION_HOST: undefined },
    { NEON_RUNTIME_HOST: productionHost, DATABASE_URL: url(productionHost) },
    { DATABASE_URL: url(previewHost, "sslmode=require") },
    { DATABASE_URL: url(previewHost, `sslmode=verify-full&host=${productionHost}`) },
    { DATABASE_URL: url(previewHost, "sslmode=verify-full&options=endpoint%3Dproduction") },
    { DATABASE_URL: url(previewHost).replace("palonex_runtime", "owner") },
    { DATABASE_URL: url(previewHost, "sslmode=verify-full&sslmode=disable") },
    { DATABASE_URL: url(previewHost.replace("-pooler.", ".")) },
    { DATABASE_URL: "postgresql://localhost/palonex" },
    { DATABASE_URL_UNPOOLED: url(previewHost.replace("-pooler.", ".")) },
  ]) assert.throws(() => runtimeDatabaseUrl({ ...preview, ...changes }));
});

test("operator connection prefers direct Neon with branch pin and preserves local loopback", () => {
  const direct = url(previewHost.replace("-pooler.", "."));
  assert.equal(operatorDatabaseUrl({ DATABASE_URL_UNPOOLED: direct, DATABASE_URL: url(previewHost), NEON_RUNTIME_HOST: previewHost }), direct);
  assert.equal(operatorDatabaseUrl({ DATABASE_URL: "postgresql://localhost/palonex" }), "postgresql://localhost/palonex");
  assert.throws(() => operatorDatabaseUrl({ DATABASE_URL: direct }));
  assert.throws(() => operatorDatabaseUrl({ DATABASE_URL: `postgresql://localhost/db?host=${productionHost}` }));
  assert.throws(() => operatorDatabaseUrl({ DATABASE_URL_UNPOOLED: "postgresql://unexpected.example.test/db", NEON_RUNTIME_HOST: previewHost }));
  assert.throws(() => operatorDatabaseUrl({ DATABASE_URL_UNPOOLED: url(previewHost), NEON_RUNTIME_HOST: previewHost }));
  assert.throws(() => operatorDatabaseUrl({ DATABASE_URL_UNPOOLED: direct, NEON_RUNTIME_HOST: productionHost }));
  assert.throws(() => operatorDatabaseUrl({ DATABASE_URL_UNPOOLED: direct, VERCEL_ENV: "production" }));
});

test("Vercel limits use its single trusted IP header and ignore a configurable override", () => {
  const headers = { "x-vercel-forwarded-for": "192.0.2.1", "x-user-header": "198.51.100.1" };
  const req = new Request("https://example.test", { headers });
  assert.equal(trustedClientIp(req, { VERCEL: "1", ENQUIRY_TRUSTED_IP_HEADER: "x-user-header" }), "192.0.2.1");
  assert.equal(trustedClientIp(req, {}), "");
  assert.equal(trustedClientIp(req, { ENQUIRY_TRUSTED_IP_HEADER: "x-user-header" }), "198.51.100.1");
});

test("mail workers require bearer authentication, opt in and enforce the preview recipient", async () => {
  const secret = "test-only-fixture-1234567890-1234567890";
  const request = new Request("https://example.test", { headers: { authorization: `Bearer ${secret}` } });
  assert.throws(() => authorizeWorker(new Request(request.url), { CRON_SECRET: secret, MAIL_WORKERS_ENABLED: "true" }), { status: 401 });
  assert.equal(authorizeWorker(request, { CRON_SECRET: secret }), false);
  assert.equal(authorizeWorker(request, { CRON_SECRET: secret, MAIL_WORKERS_ENABLED: "true" }), true);
  const accepted: string[] = [];
  const provider = { async send(email: { to: string }) { accepted.push(email.to); } };
  assert.throws(() => restrictPreviewMail(provider, { VERCEL_ENV: "preview" }), { status: 503 });
  const preview = restrictPreviewMail(provider, { VERCEL_ENV: "preview", PREVIEW_MAIL_TO: "allowed@example.test" });
  const message = { from: "sender@example.test", to: "other@example.test", html: "", text: "", subject: "" };
  await assert.rejects(preview.send(message, "test-key"));
  await preview.send({ ...message, to: "allowed@example.test" }, "test-key");
  assert.deepEqual(accepted, ["allowed@example.test"]);
});

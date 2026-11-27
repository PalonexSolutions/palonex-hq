import assert from "node:assert/strict";
import { test } from "node:test";
import { enquirySchema } from "../../features/enquiries/schema.ts";
import { checkOrigin, checkToken, issueToken, rateKeys } from "../../lib/server/enquiry-security.ts";
import { handleError, readJson } from "../../lib/server/http.ts";

process.env.ENQUIRY_SIGNING_SECRET = "test-only-key-not-for-production".repeat(2);
process.env.APP_ORIGIN = "https://example.test";

test("server validates and normalizes enquiry fields", () => {
  const input = { fullName: " Example person ", email: "EXAMPLE@EXAMPLE.TEST", category: "general", subject: "Valid subject",
    message: "This is valid text. 🌱", consent: true, token: "token", website: "" };
  assert.equal(enquirySchema.parse(input).email, "example@example.test");
  assert.equal(enquirySchema.parse(input).organization, null);
  for (const patch of [
    { email: "invalid" }, { consent: false }, { website: "spam" }, { subject: "x" },
    { fullName: "User\nInjected" }, { message: "\0".repeat(12) }, { message: "x".repeat(5001) }, { category: "unknown" },
  ]) assert.equal(enquirySchema.safeParse({ ...input, ...patch }).success, false);
});

test("signed form tokens reject immediate, expired and modified submissions", () => {
  const now = Date.now();
  const token = issueToken(now);
  assert.match(checkToken(token, now + 2500), /^[a-f0-9-]{36}$/);
  assert.throws(() => checkToken(token, now), { status: 429 });
  assert.throws(() => checkToken(token, now + 7_200_001), { status: 400 });
  assert.throws(() => checkToken(token.replace(/.$/, char => char === "A" ? "B" : "A"), now + 2500), { status: 400 });
});

test("origin is exact and rate keys contain neither email nor IP", () => {
  const request = new Request("https://example.test/api/enquiries", { headers: { Origin: "https://example.test", "X-Test-IP": "192.0.2.1" } });
  checkOrigin(request);
  assert.throws(() => checkOrigin(new Request(request.url)), { status: 403 });
  assert.throws(() => checkOrigin(new Request(request.url, { headers: { Origin: "https://example.test.invalid" } })), { status: 403 });
  process.env.ENQUIRY_TRUSTED_IP_HEADER = "x-test-ip";
  assert.ok(rateKeys(request, "private@example.test").some(key => key.limit === 12));
  assert.ok(rateKeys(request, "private@example.test").every(key => /^[\w-]{43}$/.test(key.key)));
});

test("body validation bounds actual bytes and rejects malformed JSON with safe errors", async () => {
  const request = (body: string, type = "application/json") => new Request("https://example.test", {
    method: "POST", headers: { "Content-Type": type }, body,
  });
  assert.deepEqual(await readJson(request('{"value":1}'), 32), { value: 1 });
  await assert.rejects(readJson(request("x".repeat(20)), 10), { status: 413 });
  await assert.rejects(readJson(request("{"), 10), { status: 400 });
  await assert.rejects(readJson(request("{}", "text/plain"), 10), { status: 415 });
  const response = handleError("test.synthetic_failure", new Error("private details"));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private details"));
});

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { consentVersion } from "../../features/identity/schema.ts";
import { getDatabase } from "../../lib/server/database.ts";
import { currentIdentity, identityAuth, limitIdentity, requireIdentity } from "../../lib/server/identity-auth.ts";
import { changeIdentityStatus, identityListing } from "../../lib/server/identity-admin.ts";
import { consumeIdentityLink, deliverIdentityMail } from "../../lib/server/identity-mail.ts";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Use a dedicated local TEST_DATABASE_URL.");
process.env.DATABASE_URL = url;
process.env.APP_ORIGIN = "https://identity.example.test";
process.env.PUBLIC_AUTH_SECRET = randomUUID().repeat(2);
const db = getDatabase();
const email = `${randomUUID()}@example.test`;
const password = `First-passphrase-${randomUUID()}`;
const nextPassword = `Reset-passphrase-${randomUUID()}`;
const actor = randomUUID();
after(async () => {
  try { await db.query("DELETE FROM palonex_private.identity_user WHERE email=$1", [email]); }
  finally { await db.end(); }
});

test("verified identity, durable email, single-use links, recovery and audited suspension", async () => {
  const auth = identityAuth().api;
  const created = await auth.signUpEmail({ body: {
    name: "Identity Fixture", email, password, consentVersion, consentedAt: new Date(),
  } });
  assert.equal(created.token, null);
  assert.equal(created.user.emailVerified, false);
  const id = created.user.id;
  const loginResponse = (value: string) => auth.signInEmail({ body: { email, password: value }, asResponse: true });
  assert.equal((await loginResponse(password)).status, 403);
  await auth.sendVerificationEmail({ body: { email } });
  const firstFailure = await deliverIdentityMail({ async send() { throw new Error("Synthetic send failure"); } }, "sender@example.test");
  assert.deepEqual(firstFailure, { sent: 0, failed: 1 });
  await db.query("UPDATE palonex_private.identity_mail SET available_at=now() WHERE user_id=$1", [id]);
  let emailed = "";
  const send = { async send(message: { text: string; to: string }) {
    assert.equal(message.to, email);
    emailed = message.text.split("\n")[2];
  } };
  assert.deepEqual(await deliverIdentityMail(send, "sender@example.test"), { sent: 1, failed: 0 });
  const expiredVerify = new URL(emailed).hash.slice(1);
  assert.deepEqual(await deliverIdentityMail(send, "sender@example.test"), { sent: 0, failed: 0 });
  await db.query("UPDATE palonex_private.identity_mail SET expires_at=now()-interval '1 second' WHERE user_id=$1", [id]);
  await assert.rejects(consumeIdentityLink("verify", expiredVerify), { status: 400 });
  await auth.sendVerificationEmail({ body: { email } });
  assert.deepEqual(await deliverIdentityMail(send, "sender@example.test"), { sent: 1, failed: 0 });
  const verifyLink = new URL(emailed).hash.slice(1);
  const results = await Promise.allSettled([consumeIdentityLink("verify", verifyLink), consumeIdentityLink("verify", verifyLink)]);
  const available = results.find(result => result.status === "fulfilled");
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.ok(available?.status === "fulfilled");
  assert.equal((await auth.verifyEmail({ query: { token: available.value }, asResponse: true })).status, 200);
  const response = await loginResponse(password);
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().find(value => value.includes("session_token="))!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /; Secure/i);
  assert.match(cookie, /SameSite=Lax/i);
  const session = new Headers({ Cookie: cookie.split(";")[0] });
  assert.equal((await currentIdentity(session))?.id, id);
  await assert.rejects(requireIdentity(session, "intern"), { status: 403 });
  await db.query("INSERT INTO palonex_private.identity_role (user_id,role) VALUES ($1,'intern')", [id]);
  assert.equal((await requireIdentity(session, "intern")).id, id);
  assert.equal(await currentIdentity(new Headers({ Cookie: cookie.split(";")[0].replace("palonex-public", "palonex-admin") })), null);

  await auth.requestPasswordReset({ body: { email } });
  assert.deepEqual(await deliverIdentityMail(send, "sender@example.test"), { sent: 1, failed: 0 });
  const resetLink = new URL(emailed).hash.slice(1);
  const token = await consumeIdentityLink("reset", resetLink);
  await assert.rejects(consumeIdentityLink("reset", resetLink), { status: 400 });
  assert.ok(!(await db.query("SELECT identifier FROM palonex_private.identity_verification")).rows.some(row => row.identifier.includes(token)));
  assert.equal((await auth.resetPassword({ body: { token, newPassword: nextPassword } })).status, true);
  assert.equal(await currentIdentity(session), null);
  assert.equal((await loginResponse(password)).status, 401);
  assert.equal((await loginResponse(nextPassword)).status, 200);

  await auth.requestPasswordReset({ body: { email } });
  assert.deepEqual(await deliverIdentityMail(send, "sender@example.test"), { sent: 1, failed: 0 });
  await db.query("UPDATE palonex_private.identity_mail SET expires_at=now()-interval '1 second' WHERE user_id=$1 AND consumed_at IS NULL", [id]);
  await assert.rejects(consumeIdentityLink("reset", new URL(emailed).hash.slice(1)), { status: 400 });

  await changeIdentityStatus(actor, id, "active", "suspended");
  assert.equal((await db.query('SELECT 1 FROM palonex_private.identity_session WHERE "userId"=$1', [id])).rowCount, 0);
  assert.equal((await identityListing(id, 1)).items[0].status, "suspended");
  await changeIdentityStatus(actor, id, "suspended", "active");
  assert.deepEqual((await db.query("SELECT previous_status,new_status FROM palonex_private.identity_audit WHERE user_id=$1 ORDER BY id", [id])).rows,
    [{ previous_status: "active", new_status: "suspended" }, { previous_status: "suspended", new_status: "active" }]);
});

test("resend throttling is shared through PostgreSQL", async () => {
  const request = new Request("https://identity.example.test");
  const subject = randomUUID();
  for (let attempt = 0; attempt < 3; attempt++) await limitIdentity(request, "resend", subject);
  await assert.rejects(limitIdentity(request, "resend", subject), { status: 429 });
});

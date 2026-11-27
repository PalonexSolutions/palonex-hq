import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { changeEnquiry, adminEnquiry } from "../../lib/server/admin-enquiries.ts";
import { disableAdmin, getAdminAuth, limitLogin, provisionAdmin, requireAdmin } from "../../lib/server/admin-auth.ts";
import { getDatabase } from "../../lib/server/database.ts";
import { listEnquiries } from "../../lib/server/enquiries.ts";

const url = process.env.TEST_DATABASE_URL;
if (!url || !["localhost", "127.0.0.1"].includes(new URL(url).hostname)) throw new Error("Use a dedicated local TEST_DATABASE_URL.");
process.env.DATABASE_URL = url;
process.env.APP_ORIGIN = "https://admin.example.test";
process.env.BETTER_AUTH_SECRET = randomUUID().repeat(2);

const db = getDatabase();
const marker = randomUUID();
const email = `${marker}@example.test`;
const password = randomUUID();
const records: string[] = [];
let actor = "";

after(async () => {
  try {
    await db.query("DELETE FROM palonex_private.enquiries WHERE id=ANY($1::uuid[])", [records]);
    await db.query("DELETE FROM palonex_private.admin_user WHERE id=$1", [actor]);
  } finally { await db.end(); }
});

test("Better Auth verifies credentials and rejects expired and disabled accounts", async () => {
  actor = await provisionAdmin(email, "Staff Fixture", password);
  const { rows } = await db.query("SELECT password FROM palonex_private.admin_account WHERE \"userId\"=$1", [actor]);
  assert.ok(rows[0].password.length > 0);
  assert.notEqual(rows[0].password, password);
  const auth = getAdminAuth();
  const login = (value: string) => auth.api.signInEmail({ body: { email, password: value }, asResponse: true });
  assert.equal((await login("incorrect password")).status, 401);
  const response = await login(password);
  assert.equal(response.status, 200);
  const cookie = response.headers.getSetCookie().find(value => value.includes("session_token="))!;
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /; Secure/i);
  const headers = new Headers({ Cookie: cookie.split(";")[0] });
  const session = await requireAdmin(headers);
  assert.equal(session.id, actor);
  await db.query("UPDATE palonex_private.admin_session SET \"expiresAt\"=now() - interval '1 second' WHERE id=$1", [session.sessionId]);
  await assert.rejects(requireAdmin(headers), { status: 401 });
  const next = await login(password);
  const nextHeaders = new Headers({ Cookie: next.headers.getSetCookie().find(value => value.includes("session_token="))!.split(";")[0] });
  await requireAdmin(nextHeaders);
  assert.equal(await disableAdmin(email), true);
  await assert.rejects(requireAdmin(nextHeaders), { status: 401 });
});

test("database-backed login limit rejects additional attempts", async () => {
  const request = new Request("https://admin.example.test/api/admin/session");
  for (let count = 0; count < 10; count++) await limitLogin(request, email);
  await assert.rejects(limitLogin(request, email), { status: 429 });
});

test("privileged note and status writes produce append-only audit records and support reference search", async () => {
  for (let index = 0; index < 3; index++) {
    const id = randomUUID();
    await db.query(`
      INSERT INTO palonex_private.enquiries (id,submission_id,fingerprint,full_name,email,category,subject,message,privacy_version,created_at)
      VALUES ($1,$2,'fixture','Staff Search Fixture',$3,'general','Admin test fixture','Private test message.', 'fixture', now() + $4 * interval '1 second')`,
    [id, randomUUID(), email, index]);
    records.push(id);
  }
  const first = await listEnquiries({ search: email, status: "NEW", category: "general", limit: 1, order: "oldest" });
  assert.equal(first.items[0].id, records[0]);
  assert.ok(first.nextCursor);
  const next = await listEnquiries({ search: email, limit: 1, order: "oldest", cursor: first.nextCursor });
  assert.equal(next.items[0].id, records[1]);
  assert.equal((await listEnquiries({ search: records[1] })).items[0].id, records[1]);

  const id = records[0];
  await assert.rejects(changeEnquiry(actor, id, { action: "status", from: "NEW", to: "RESOLVED" }), { status: 409 });
  await changeEnquiry(actor, id, { action: "status", from: "NEW", to: "IN_PROGRESS" });
  await assert.rejects(changeEnquiry(actor, id, { action: "status", from: "NEW", to: "ARCHIVED" }), { status: 409 });
  await changeEnquiry(actor, id, { action: "note", note: "Private internal fixture." });
  const data = await adminEnquiry(id);
  assert.equal(data?.enquiry.status, "IN_PROGRESS");
  assert.equal(data?.notes[0].body, "Private internal fixture.");
  assert.deepEqual(data?.audit.map(entry => [entry.actor_id, entry.action, entry.previous_status, entry.new_status]),
    [[actor, "note_added", null, null], [actor, "status_changed", "NEW", "IN_PROGRESS"]]);
});
